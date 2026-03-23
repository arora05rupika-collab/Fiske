/**
 * SharePoint Integration via Microsoft Graph API
 *
 * Syncs supplier submissions to a SharePoint list and uploads
 * compliance documents to a SharePoint document library.
 *
 * SETUP REQUIRED:
 * ──────────────────────────────────────────────────────────────
 * 1. Azure AD App Registration:
 *    - Go to portal.azure.com > Azure Active Directory > App registrations
 *    - New registration, note the Application (client) ID and Directory (tenant) ID
 *    - Certificates & secrets > New client secret → copy value to AZURE_CLIENT_SECRET
 *    - API permissions > Add > Microsoft Graph > Application permissions:
 *        Sites.ReadWrite.All
 *    - Grant admin consent
 *
 * 2. SharePoint List "Supplier Compliance Submissions":
 *    Create these columns (Settings > Add column):
 *    - Title              (built-in, used for Reference Number)
 *    - CompanyName        Single line of text
 *    - ContactName        Single line of text
 *    - ContactEmail       Single line of text
 *    - Country            Single line of text
 *    - SubmissionDate     Date and Time
 *    - Status             Choice (Submitted, Under Review, Approved, Rejected)
 *    - RegulatoryCompliant  Choice (Yes, No, Partial)
 *    - RegulatoryPenalties  Yes/No
 *    - PenaltyDetails     Multiple lines of text
 *    - KosherCertExpiry   Date and Time  ← Power Automate monitors this
 *    - KosherCertBody     Single line of text
 *    - KosherCertNA       Yes/No
 *    - HalalCertExpiry    Date and Time  ← Power Automate monitors this
 *    - HalalCertBody      Single line of text
 *    - HalalCertNA        Yes/No
 *    - NSFCertExpiry      Date and Time  ← Power Automate monitors this (earliest)
 *    - NSFCertDetails     Multiple lines of text
 *    - Products           Multiple lines of text
 *    - SignatoryName      Single line of text
 *    - SignatoryTitle     Single line of text
 *
 * 3. Get required IDs using Graph Explorer (https://developer.microsoft.com/graph/graph-explorer):
 *    - Site ID:  GET https://graph.microsoft.com/v1.0/sites/{your-tenant}.sharepoint.com:/{site-path}
 *    - List ID:  GET https://graph.microsoft.com/v1.0/sites/{siteId}/lists
 *    - Drive ID: GET https://graph.microsoft.com/v1.0/sites/{siteId}/drives
 *
 * 4. Power Automate — Expiry Notification Flow:
 *    - Trigger: Recurrence (Daily, 8:00 AM)
 *    - Action: "Get items" from SharePoint list
 *      Filter: KosherCertExpiry le '[utcNow('yyyy-MM-dd')]' addDays(utcNow(), 60)
 *      (repeat for HalalCertExpiry and NSFCertExpiry)
 *    - Condition: If any items found
 *    - Action: Send an email (V2) with the expiring certificate details
 * ──────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

class SharePointService {
  constructor() {
    this.tenantId = process.env.AZURE_TENANT_ID;
    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET;
    this.siteId = process.env.SHAREPOINT_SITE_ID;
    this.listId = process.env.SHAREPOINT_LIST_ID;
    this.driveId = process.env.SHAREPOINT_DRIVE_ID; // Document library drive ID
    this._accessToken = null;
    this._tokenExpiry = null;
  }

  isConfigured() {
    return !!(this.tenantId && this.clientId && this.clientSecret && this.siteId && this.listId);
  }

  async getAccessToken() {
    if (this._accessToken && this._tokenExpiry && Date.now() < this._tokenExpiry) {
      return this._accessToken;
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'https://graph.microsoft.com/.default'
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Azure AD token error: ${err}`);
    }

    const data = await response.json();
    this._accessToken = data.access_token;
    this._tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this._accessToken;
  }

  async graphRequest(method, endpoint, body = null, contentType = 'application/json') {
    const token = await this.getAccessToken();
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType
      }
    };
    if (body) {
      options.body = contentType === 'application/json' ? JSON.stringify(body) : body;
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, options);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Graph API error ${response.status}: ${err}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /**
   * Main entry point — called after Step 4 submission is complete.
   * Failures are non-fatal and will not break the supplier submission.
   */
  async syncSubmission(submission, products) {
    if (!this.isConfigured()) {
      console.log('[SharePoint] Not configured — skipping sync. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, SHAREPOINT_SITE_ID, SHAREPOINT_LIST_ID in .env to enable.');
      return;
    }

    try {
      console.log(`[SharePoint] Syncing submission ${submission.reference_number}...`);

      // 1. Create list item
      const listItem = await this.createListItem(submission, products);
      console.log(`[SharePoint] List item created: ${listItem.id}`);

      // 2. Upload documents to document library (if drive configured)
      if (this.driveId) {
        await this.uploadDocuments(submission, products);
        console.log(`[SharePoint] Documents uploaded for ${submission.reference_number}`);
      }

      console.log(`[SharePoint] Sync complete for ${submission.reference_number}`);
    } catch (err) {
      console.error(`[SharePoint] Sync failed (non-fatal): ${err.message}`);
    }
  }

  async createListItem(submission, products) {
    // Build product summary string
    const productSummary = products
      .map(p => `${p.product_name} (${p.product_type})`)
      .join('\n');

    // Find the earliest NSF cert expiry across all food-grade products
    const nsfExpiries = products
      .filter(p => p.nsf_cert_expiry)
      .sort((a, b) => new Date(a.nsf_cert_expiry) - new Date(b.nsf_cert_expiry));

    const earliestNsfExpiry = nsfExpiries[0]?.nsf_cert_expiry || null;
    const nsfDetails = nsfExpiries
      .map(p => `${p.product_name}: ${p.nsf_cert_expiry}${p.nsf_registration_number ? ' (Reg: ' + p.nsf_registration_number + ')' : ''}`)
      .join('\n');

    const fields = {
      Title: submission.reference_number,
      CompanyName: submission.company_name || '',
      ContactName: submission.contact_name || '',
      ContactEmail: submission.contact_email || '',
      Country: submission.country || '',
      SubmissionDate: submission.submission_date || new Date().toISOString(),
      Status: submission.status || 'Submitted',
      RegulatoryCompliant: submission.regulatory_compliant || '',
      RegulatoryPenalties: submission.regulatory_penalties === 'Yes',
      PenaltyDetails: submission.penalty_details || '',
      KosherCertNA: submission.kosher_cert_na === 1,
      KosherCertExpiry: submission.kosher_cert_expiry || null,
      KosherCertBody: submission.kosher_cert_body || '',
      HalalCertNA: submission.halal_cert_na === 1,
      HalalCertExpiry: submission.halal_cert_expiry || null,
      HalalCertBody: submission.halal_cert_body || '',
      NSFCertExpiry: earliestNsfExpiry,
      NSFCertDetails: nsfDetails,
      Products: productSummary,
      SignatoryName: submission.signatory_name || '',
      SignatoryTitle: submission.signatory_title || ''
    };

    // Remove null date fields (SharePoint rejects null for date columns — use empty string or omit)
    if (!fields.KosherCertExpiry) delete fields.KosherCertExpiry;
    if (!fields.HalalCertExpiry) delete fields.HalalCertExpiry;
    if (!fields.NSFCertExpiry) delete fields.NSFCertExpiry;

    return this.graphRequest(
      'POST',
      `/sites/${this.siteId}/lists/${this.listId}/items`,
      { fields }
    );
  }

  async uploadDocuments(submission, products) {
    const refNum = submission.reference_number;

    // Helper: upload a single local file to SharePoint
    const upload = async (localRelativePath, spFileName) => {
      if (!localRelativePath) return;
      const absPath = path.join(__dirname, localRelativePath.startsWith('/') ? '' : '/', localRelativePath);
      if (!fs.existsSync(absPath)) {
        console.warn(`[SharePoint] File not found, skipping: ${absPath}`);
        return;
      }
      const ext = path.extname(localRelativePath);
      const spPath = `/${refNum}/${spFileName}${ext}`;
      const fileBuffer = fs.readFileSync(absPath);
      const token = await this.getAccessToken();

      const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${this.siteId}/drives/${this.driveId}/root:${spPath}:/content`;
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/octet-stream'
        },
        body: fileBuffer
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`[SharePoint] Upload failed for ${spFileName}: ${err}`);
      }
    };

    // Upload submission-level documents
    await upload(submission.kosher_cert_file_path, 'Kosher_Certificate');
    await upload(submission.halal_cert_file_path, 'Halal_Certificate');
    await upload(submission.signature_image_path, 'Signature');

    // Upload per-product documents
    for (const product of products) {
      const safeName = product.product_name.replace(/[^a-zA-Z0-9]/g, '_');
      await upload(product.sds_file_path, `${safeName}_SDS`);
      await upload(product.tds_file_path, `${safeName}_TDS`);
      await upload(product.nsf_cert_file_path, `${safeName}_NSF_Certificate`);
    }
  }
}

module.exports = new SharePointService();
