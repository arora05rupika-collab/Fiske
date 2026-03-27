const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { sendConfirmationEmail, sendTeamNotificationEmail } = require('../email');
const sharepoint = require('../sharepoint');
const { fromFile } = require('file-type');
const { scanFile } = require('../virustotal');

// Magic bytes map: what the actual file content should start with per extension
const ALLOWED_MIME_TYPES = {
  '.pdf':  ['application/pdf'],
  '.jpg':  ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png':  ['image/png'],
  '.doc':  ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// Validate file content matches its extension (magic bytes check)
async function validateFileContent(filePath, declaredExt) {
  const type = await fromFile(filePath);

  // fromFile returns null for DOC/DOCX sometimes (they're ZIP-based) — allow those through
  // but still reject if we detect something dangerous
  if (!type) {
    // Could not detect type — only allow doc/docx in this case
    if (['.doc', '.docx'].includes(declaredExt)) return true;
    return false;
  }

  const allowedMimes = ALLOWED_MIME_TYPES[declaredExt] || [];

  // Explicitly block dangerous types regardless of extension
  const dangerous = [
    'application/x-msdownload', // .exe
    'application/x-executable',
    'application/x-sh',          // shell script
    'application/x-bat',
    'application/javascript',
    'text/javascript',
    'application/x-php',
    'application/x-python',
  ];

  if (dangerous.includes(type.mime)) return false;

  return allowedMimes.includes(type.mime);
}

// Delete a file safely (non-fatal)
function safeUnlink(filePath) {
  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
}

// Dynamic multer storage based on submission id
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const submissionId = req.params.id || req.body.submission_id || 'temp';
    const productName = req.body.product_name
      ? req.body.product_name.replace(/[^a-zA-Z0-9-_]/g, '_')
      : null;

    let uploadPath;
    if (productName) {
      uploadPath = path.join(__dirname, '..', 'uploads', submissionId, productName);
    } else {
      uploadPath = path.join(__dirname, '..', 'uploads', submissionId);
    }

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

// Generate reference number
function generateRef() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `LUB-${y}${m}${d}-${rand}`;
}

// Step 1: Create submission with company info
router.post('/step1', (req, res) => {
  try {
    const db = getDb();
    const id = uuidv4();
    const { company_name, contact_name, contact_email, country, products } = req.body;

    if (!company_name || !contact_name || !contact_email) {
      return res.status(400).json({ error: 'Company name, contact name and email are required' });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'At least one product is required' });
    }

    const ref = generateRef();

    db.prepare(`
      INSERT INTO SupplierSubmissions (id, company_name, contact_name, contact_email, country, reference_number, step_completed)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(id, company_name, contact_name, contact_email, country || null, ref);

    // Insert products
    const insertProduct = db.prepare(`
      INSERT INTO SupplierProducts (id, submission_id, product_name, product_type, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    const productIds = [];
    products.forEach((product, index) => {
      const productId = uuidv4();
      insertProduct.run(productId, id, product.product_name, product.product_type, index);
      productIds.push({ ...product, id: productId });
    });

    res.json({ id, reference_number: ref, products: productIds });
  } catch (err) {
    console.error('Step 1 error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Update compliance info (with file uploads)
const step2Upload = upload.fields([
  { name: 'kosher_cert_file', maxCount: 1 },
  { name: 'halal_cert_file', maxCount: 1 },
  { name: 'sds_file_0', maxCount: 1 }, { name: 'sds_file_1', maxCount: 1 },
  { name: 'sds_file_2', maxCount: 1 }, { name: 'sds_file_3', maxCount: 1 },
  { name: 'sds_file_4', maxCount: 1 }, { name: 'sds_file_5', maxCount: 1 },
  { name: 'sds_file_6', maxCount: 1 }, { name: 'sds_file_7', maxCount: 1 },
  { name: 'sds_file_8', maxCount: 1 }, { name: 'sds_file_9', maxCount: 1 },
  { name: 'tds_file_0', maxCount: 1 }, { name: 'tds_file_1', maxCount: 1 },
  { name: 'tds_file_2', maxCount: 1 }, { name: 'tds_file_3', maxCount: 1 },
  { name: 'tds_file_4', maxCount: 1 }, { name: 'tds_file_5', maxCount: 1 },
  { name: 'tds_file_6', maxCount: 1 }, { name: 'tds_file_7', maxCount: 1 },
  { name: 'tds_file_8', maxCount: 1 }, { name: 'tds_file_9', maxCount: 1 },
  { name: 'nsf_cert_file_0', maxCount: 1 }, { name: 'nsf_cert_file_1', maxCount: 1 },
  { name: 'nsf_cert_file_2', maxCount: 1 }, { name: 'nsf_cert_file_3', maxCount: 1 },
  { name: 'nsf_cert_file_4', maxCount: 1 }, { name: 'nsf_cert_file_5', maxCount: 1 },
  { name: 'nsf_cert_file_6', maxCount: 1 }, { name: 'nsf_cert_file_7', maxCount: 1 },
  { name: 'nsf_cert_file_8', maxCount: 1 }, { name: 'nsf_cert_file_9', maxCount: 1 },
]);

router.patch('/:id/step2', step2Upload, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const body = req.body;
    const files = req.files || {};

    const submission = db.prepare('SELECT * FROM SupplierSubmissions WHERE id = ?').get(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    // ── Security Layer 1: Magic bytes ──────────────────────────────────────────
    // Verify every uploaded file's actual content matches its claimed extension
    const allUploadedFiles = Object.values(files).flat();
    for (const file of allUploadedFiles) {
      const ext = path.extname(file.originalname).toLowerCase();
      const isValid = await validateFileContent(file.path, ext);
      if (!isValid) {
        allUploadedFiles.forEach(f => safeUnlink(f.path));
        return res.status(400).json({
          error: `File "${file.originalname}" failed security validation. The file content does not match its extension. Please upload a genuine ${ext.toUpperCase()} file.`
        });
      }
    }

    // ── Security Layer 2: VirusTotal (70+ antivirus engines) ───────────────────
    // Scans each file against VirusTotal's database. Skipped gracefully if
    // VIRUSTOTAL_API_KEY is not set or if the API is unreachable.
    for (const file of allUploadedFiles) {
      const vtResult = await scanFile(file.path);

      if (vtResult.safe === false) {
        // Threat detected — delete all uploaded files immediately
        allUploadedFiles.forEach(f => safeUnlink(f.path));
        return res.status(400).json({
          error: `File "${file.originalname}" was flagged as potentially malicious by ${vtResult.detections} security engine(s) (${vtResult.engines?.slice(0, 3).join(', ')}${vtResult.engines?.length > 3 ? '...' : ''}). Please contact Lubriplate if you believe this is a false positive.`
        });
      }
      // vtResult.skipped === true means API key not set or VT unreachable — we
      // still allow the upload since magic bytes already passed
    }

    // File path helper
    const getFilePath = (fileKey) => {
      if (files[fileKey] && files[fileKey][0]) {
        return files[fileKey][0].path.replace(path.join(__dirname, '..'), '');
      }
      return null;
    };

    // Update submission-level compliance fields
    const kosherFilePath = getFilePath('kosher_cert_file');
    const halalFilePath = getFilePath('halal_cert_file');

    db.prepare(`
      UPDATE SupplierSubmissions SET
        regulatory_compliant = ?,
        regulatory_penalties = ?,
        penalty_details = ?,
        kosher_cert_na = ?,
        kosher_cert_expiry = ?,
        kosher_cert_body = ?,
        kosher_cert_file_path = COALESCE(?, kosher_cert_file_path),
        halal_cert_na = ?,
        halal_cert_expiry = ?,
        halal_cert_body = ?,
        halal_cert_file_path = COALESCE(?, halal_cert_file_path),
        step_completed = 2
      WHERE id = ?
    `).run(
      body.regulatory_compliant || null,
      body.regulatory_penalties || null,
      body.penalty_details || null,
      body.kosher_cert_na === 'true' || body.kosher_cert_na === true ? 1 : 0,
      body.kosher_cert_expiry || null,
      body.kosher_cert_body || null,
      kosherFilePath,
      body.halal_cert_na === 'true' || body.halal_cert_na === true ? 1 : 0,
      body.halal_cert_expiry || null,
      body.halal_cert_body || null,
      halalFilePath,
      id
    );

    // Update products
    const products = db.prepare('SELECT * FROM SupplierProducts WHERE submission_id = ? ORDER BY sort_order').all(id);

    products.forEach((product, index) => {
      const productData = body[`products[${index}]`] ? JSON.parse(body[`products[${index}]`]) : {};
      const sdsPath = getFilePath(`sds_file_${index}`);
      const tdsPath = getFilePath(`tds_file_${index}`);
      const nsfPath = getFilePath(`nsf_cert_file_${index}`);

      db.prepare(`
        UPDATE SupplierProducts SET
          pfas_free = ?,
          moah_free = ?,
          sds_file_path = COALESCE(?, sds_file_path),
          tds_file_path = COALESCE(?, tds_file_path),
          nsf_cert_file_path = COALESCE(?, nsf_cert_file_path),
          nsf_cert_expiry = ?,
          nsf_registration_number = ?
        WHERE id = ?
      `).run(
        body[`pfas_free_${index}`] || productData.pfas_free || null,
        body[`moah_free_${index}`] || productData.moah_free || null,
        sdsPath,
        tdsPath,
        nsfPath,
        body[`nsf_expiry_${index}`] || productData.nsf_cert_expiry || null,
        body[`nsf_reg_${index}`] || productData.nsf_registration_number || null,
        product.id
      );
    });

    res.json({ success: true, id });
  } catch (err) {
    console.error('Step 2 error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Step 3: Save allergen data
router.patch('/:id/step3', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { allergens, cross_contamination_procedures, wheat_starch_packaging } = req.body;

    const submission = db.prepare('SELECT * FROM SupplierSubmissions WHERE id = ?').get(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    db.prepare(`
      UPDATE SupplierSubmissions SET
        cross_contamination_procedures = ?,
        wheat_starch_packaging = ?,
        step_completed = 3
      WHERE id = ?
    `).run(cross_contamination_procedures || null, wheat_starch_packaging || null, id);

    // Delete existing allergens for this submission
    db.prepare('DELETE FROM SupplierAllergens WHERE submission_id = ?').run(id);

    // Insert new allergen data
    if (allergens && Array.isArray(allergens)) {
      const insertAllergen = db.prepare(`
        INSERT INTO SupplierAllergens (id, product_id, submission_id, allergen_code, allergen_label, in_product, same_line, same_plant)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      allergens.forEach(a => {
        insertAllergen.run(
          uuidv4(), a.product_id, id,
          a.allergen_code, a.allergen_label,
          a.in_product || 'N/A', a.same_line || 'N/A', a.same_plant || 'N/A'
        );
      });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error('Step 3 error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Step 4: Final submission with signature
const signatureUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'uploads', req.params.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, 'signature.png')
  })
});

router.patch('/:id/step4', signatureUpload.single('signature_image'), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { signatory_name, signatory_title, signature_data } = req.body;

    const submission = db.prepare('SELECT * FROM SupplierSubmissions WHERE id = ?').get(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    let signaturePath = null;

    // Handle base64 signature data
    if (signature_data) {
      const base64Data = signature_data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const sigDir = path.join(__dirname, '..', 'uploads', id);
      fs.mkdirSync(sigDir, { recursive: true });
      const sigPath = path.join(sigDir, 'signature.png');
      fs.writeFileSync(sigPath, buffer);
      signaturePath = `/uploads/${id}/signature.png`;
    } else if (req.file) {
      signaturePath = req.file.path.replace(path.join(__dirname, '..'), '');
    }

    const submissionDate = new Date().toISOString();

    db.prepare(`
      UPDATE SupplierSubmissions SET
        signatory_name = ?,
        signatory_title = ?,
        signature_image_path = COALESCE(?, signature_image_path),
        submission_date = ?,
        status = 'Submitted',
        step_completed = 4
      WHERE id = ?
    `).run(signatory_name, signatory_title, signaturePath, submissionDate, id);

    // Send emails
    const updatedSubmission = db.prepare('SELECT * FROM SupplierSubmissions WHERE id = ?').get(id);
    const products = db.prepare('SELECT * FROM SupplierProducts WHERE submission_id = ?').all(id);

    try {
      await sendConfirmationEmail(updatedSubmission, products);
      await sendTeamNotificationEmail(updatedSubmission, products);
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr.message);
    }

    // Sync to SharePoint (non-fatal — runs in background)
    sharepoint.syncSubmission(updatedSubmission, products).catch(err =>
      console.error('SharePoint sync error (non-fatal):', err.message)
    );

    res.json({
      success: true,
      id,
      reference_number: submission.reference_number,
      company_name: submission.company_name,
      contact_email: submission.contact_email
    });
  } catch (err) {
    console.error('Step 4 error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET submission by ID
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const submission = db.prepare('SELECT * FROM SupplierSubmissions WHERE id = ?').get(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Not found' });

    const products = db.prepare('SELECT * FROM SupplierProducts WHERE submission_id = ? ORDER BY sort_order').all(req.params.id);
    const allergens = db.prepare('SELECT * FROM SupplierAllergens WHERE submission_id = ?').all(req.params.id);

    res.json({ ...submission, products, allergens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
