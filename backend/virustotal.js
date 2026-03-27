/**
 * VirusTotal API v3 Integration
 *
 * Flow for each uploaded file:
 *  1. Calculate SHA-256 hash of the file (free, no API call)
 *  2. Check if VirusTotal already knows this hash  → 1 API call
 *     - Known + clean  → allow immediately (fast path)
 *     - Known + dirty  → reject immediately
 *  3. If hash unknown → upload file for a fresh scan  → 1 API call
 *  4. Poll for scan result (up to ~60s)              → 1-3 API calls
 *
 * Free tier limits: 4 requests/min, 500 requests/day
 * We stay well within this by checking hash first (avoids upload for known files).
 *
 * Add to Railway environment variables:
 *   VIRUSTOTAL_API_KEY=your_key_here
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios  = require('axios');
const FormData = require('form-data');

const VT_BASE = 'https://www.virustotal.com/api/v3';

// How many antivirus engines must flag a file before we block it.
// 1 = block if even ONE engine flags it (strictest).
// 3 = block if 3+ engines flag it (reduces false positives on borderline files).
const DETECTION_THRESHOLD = 2;

// Max time (ms) to wait for a fresh scan result before giving up
const SCAN_TIMEOUT_MS = 90_000;   // 90 seconds
const POLL_INTERVAL_MS = 5_000;   //  5 seconds between polls

// ─── helpers ──────────────────────────────────────────────────────────────────

function getApiKey() {
  return process.env.VIRUSTOTAL_API_KEY || null;
}

function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end',  () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function vtHeaders() {
  return { 'x-apikey': getApiKey(), 'Accept': 'application/json' };
}

/** Sleep helper so we can wait between polls without blocking the event loop */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── result interpreter ───────────────────────────────────────────────────────

/**
 * Parses a VirusTotal file/analysis object and returns a clean result:
 *   { safe: true }
 *   { safe: false, detections: 3, engines: ['Kaspersky', 'Norton', ...], permalink }
 */
function parseResult(data) {
  const stats = data?.attributes?.last_analysis_stats
             || data?.attributes?.stats
             || {};

  const malicious  = stats.malicious  || 0;
  const suspicious = stats.suspicious || 0;
  const total      = (stats.malicious || 0) + (stats.suspicious || 0)
                   + (stats.harmless  || 0) + (stats.undetected || 0);

  const flagged = malicious + suspicious;

  if (flagged >= DETECTION_THRESHOLD) {
    // Collect names of engines that flagged it
    const results  = data?.attributes?.last_analysis_results || {};
    const engines  = Object.entries(results)
      .filter(([, v]) => v.category === 'malicious' || v.category === 'suspicious')
      .map(([name]) => name)
      .slice(0, 10); // cap at 10 names for the error message

    const permalink = `https://www.virustotal.com/gui/file/${data?.id}`;

    return { safe: false, detections: flagged, total, engines, permalink };
  }

  return { safe: true, detections: flagged, total };
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** Step 1: look up a known hash. Returns null if not found. */
async function lookupHash(hash) {
  try {
    const res = await axios.get(`${VT_BASE}/files/${hash}`, {
      headers: vtHeaders(),
      timeout: 15_000,
    });
    return res.data?.data || null;
  } catch (err) {
    if (err.response?.status === 404) return null;   // unknown file — not an error
    throw err;
  }
}

/** Step 2: upload a file for a fresh scan. Returns analysis ID. */
async function uploadFile(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
  });

  const res = await axios.post(`${VT_BASE}/files`, form, {
    headers: { ...vtHeaders(), ...form.getHeaders() },
    timeout: 120_000,    // large files can take a while to upload
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return res.data?.data?.id;   // analysis ID
}

/** Step 3: poll until analysis is complete. Returns the file data object. */
async function pollAnalysis(analysisId) {
  const deadline = Date.now() + SCAN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const res = await axios.get(`${VT_BASE}/analyses/${analysisId}`, {
      headers: vtHeaders(),
      timeout: 15_000,
    });

    const status = res.data?.data?.attributes?.status;

    if (status === 'completed') {
      return res.data.data;
    }
    // status === 'queued' | 'in-progress' → keep polling
  }

  throw new Error('VirusTotal scan timed out after 90 seconds');
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Main function — call this for every uploaded file.
 *
 * Returns:
 *   { safe: true }
 *   { safe: false, reason: string }
 *   { skipped: true, reason: string }   ← when API key not set or VT unreachable
 */
async function scanFile(filePath) {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('[VirusTotal] VIRUSTOTAL_API_KEY not set — skipping scan');
    return { skipped: true, reason: 'API key not configured' };
  }

  try {
    // 1. Hash the file locally (no API call)
    const hash = await sha256OfFile(filePath);
    console.log(`[VirusTotal] Checking hash ${hash.slice(0, 12)}... for ${path.basename(filePath)}`);

    // 2. Try hash lookup first (fast path — 1 API call)
    const knownData = await lookupHash(hash);

    if (knownData) {
      console.log(`[VirusTotal] Hash known — using cached result`);
      const result = parseResult(knownData);
      logResult(filePath, result);
      return result;
    }

    // 3. Unknown file — upload for a fresh scan (2-4 API calls)
    console.log(`[VirusTotal] Hash unknown — uploading for fresh scan...`);
    const analysisId = await uploadFile(filePath);
    const analysisData = await pollAnalysis(analysisId);
    const result = parseResult(analysisData);
    logResult(filePath, result);
    return result;

  } catch (err) {
    // Network error, rate limit hit, etc. — log but don't block the upload
    // (we still have magic-bytes validation as a safety net)
    console.error(`[VirusTotal] Scan error (non-fatal): ${err.message}`);
    return { skipped: true, reason: err.message };
  }
}

function logResult(filePath, result) {
  const name = path.basename(filePath);
  if (result.safe) {
    console.log(`[VirusTotal] ✅ CLEAN  — ${name} (${result.detections}/${result.total} detections)`);
  } else {
    console.warn(`[VirusTotal] ❌ THREAT — ${name} flagged by ${result.detections} engine(s): ${result.engines?.join(', ')}`);
  }
}

module.exports = { scanFile };
