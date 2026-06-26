const https = require('https');

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`;

function getSenderEmail() {
  if (!process.env.BREVO_SENDER_EMAIL) throw new Error('BREVO_SENDER_EMAIL env var not set.');
  return process.env.BREVO_SENDER_EMAIL;
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.BREVO_API_KEY) throw new Error('BREVO_API_KEY env var not set.');
  const senderEmail = getSenderEmail();
  const body = JSON.stringify({
    sender: { name: 'Lubriplate Compliance Portal', email: senderEmail },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          try {
            const parsed = JSON.parse(data);
            reject(new Error(parsed.message || `Brevo error ${res.statusCode}`));
          } catch {
            reject(new Error(`Brevo error ${res.statusCode}: ${data}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const FOOTER = `<div style="background:#1A1A1A;padding:15px;text-align:center;"><p style="color:#888;margin:0;font-size:12px;">© ${new Date().getFullYear()} Lubriplate Lubricants Company. All rights reserved.</p></div>`;
const HEADER = `<div style="background:#CC0000;padding:18px 24px;text-align:center;"><img src="${APP_URL}/lubriplate-logo.svg" alt="Lubriplate" style="height:60px;max-width:280px;" onerror="this.style.display='none';this.nextSibling.style.display='block'"/><div style="display:none"><h1 style="color:#fff;margin:0;font-family:Arial Black,sans-serif;letter-spacing:3px;">LUBRIPLATE</h1><p style="color:#fff;margin:4px 0 0;font-size:11px;letter-spacing:3px;opacity:0.9;">LUBRICANTS COMPANY</p></div></div>`;

async function sendConfirmationEmail(submission, products) {
  await sendEmail({
    to: submission.contact_email,
    subject: `Compliance Submission Received — Ref: ${submission.reference_number}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      ${HEADER}
      <div style="padding:30px;background:#f9f9f9;">
        <h2 style="color:#1A1A1A;">Submission Confirmed ✓</h2>
        <p>Dear ${submission.contact_name},</p>
        <p>Thank you for submitting your compliance information. Your submission has been received and is under review.</p>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:20px;margin:20px 0;">
          <h3 style="color:#CC0000;margin-top:0;">Submission Details</h3>
          <p><strong>Reference Number:</strong> ${submission.reference_number}</p>
          <p><strong>Company:</strong> ${submission.company_name}</p>
          <p><strong>Submitted:</strong> ${new Date(submission.submission_date).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
          <p><strong>Products Submitted:</strong></p>
          <ul style="margin:5px 0;padding-left:20px;">${products.map(p=>`<li>${p.product_name} (${p.product_type})</li>`).join('')}</ul>
        </div>
        <p>Our quality team will review your submission and may contact you if additional information is required.</p>
        <p>Please keep your reference number: <strong>${submission.reference_number}</strong></p>
        <p style="margin-top:30px;">Best regards,<br><strong>Lubriplate Quality Team</strong><br>rarora@lubriplate.com</p>
      </div>
      ${FOOTER}</div>`
  });
}

async function sendTeamNotificationEmail(submission, products) {
  const dashboardUrl = process.env.DASHBOARD_URL || `${APP_URL}/admin`;
  await sendEmail({
    to: 'rarora@lubriplate.com',
    subject: `New Compliance Submission — ${submission.company_name} (${submission.reference_number})`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      ${HEADER}
      <div style="padding:30px;background:#f9f9f9;">
        <h2 style="color:#1A1A1A;">New Supplier Submission Received</h2>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:20px;margin:20px 0;">
          <p><strong>Reference:</strong> ${submission.reference_number}</p>
          <p><strong>Company:</strong> ${submission.company_name}</p>
          <p><strong>Contact:</strong> ${submission.contact_name} (${submission.contact_email})</p>
          <p><strong>Country:</strong> ${submission.country||'Not specified'}</p>
          <p><strong>Products:</strong> ${products.length}</p>
          <ul>${products.map(p=>`<li>${p.product_name} — ${p.product_type}</li>`).join('')}</ul>
          <p><strong>Submitted:</strong> ${new Date(submission.submission_date).toLocaleString()}</p>
        </div>
        <a href="${dashboardUrl}" style="display:inline-block;background:#CC0000;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View in Dashboard →</a>
      </div>
      ${FOOTER}</div>`
  });
}

async function sendSupplierRequestEmail(supplier) {
  const materials = supplier.materials || [];
  const supplierId = supplier.id || '';
  const formLink = `${APP_URL}/form/step1?sid=${supplierId}`;
  const materialRows = materials.map(m =>
    `<tr><td style="padding:6px 12px;border:1px solid #ddd;">${m.id}</td><td style="padding:6px 12px;border:1px solid #ddd;">${m.name}</td><td style="padding:6px 12px;border:1px solid #ddd;">${m.type}</td></tr>`
  ).join('');
  await sendEmail({
    to: supplier.contact_email,
    subject: `Compliance Document Request — Lubriplate Lubricants`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      ${HEADER}
      <div style="padding:30px;background:#f9f9f9;">
        <h2 style="color:#1A1A1A;">Compliance Document Request</h2>
        <p>Dear ${supplier.name},</p>
        <p>We are reaching out to request compliance documentation for the raw materials you supply to Lubriplate Lubricants Company.</p>
        ${materials.length ? `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead><tr style="background:#1A1A1A;color:white;">
            <th style="padding:8px 12px;text-align:left;">Code</th>
            <th style="padding:8px 12px;text-align:left;">Material</th>
            <th style="padding:8px 12px;text-align:left;">Type</th>
          </tr></thead>
          <tbody>${materialRows}</tbody>
        </table>
        <p>For <strong>Food Grade</strong> materials, please provide Kosher and Halal certificates (if applicable).<br>
        For each material, please provide SDS, TDS, and NSF certificate where applicable.</p>
        ` : '<p>Please submit relevant compliance documents for all materials you supply.</p>'}
        <div style="margin:28px 0;text-align:center;">
          <a href="${formLink}" style="display:inline-block;background:#CC0000;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">Submit Compliance Form →</a>
        </div>
        <p style="font-size:12px;color:#888;">If the button above doesn't work, copy and paste this link into your browser:<br><a href="${formLink}" style="color:#CC0000;">${formLink}</a></p>
        <p style="margin-top:30px;">Best regards,<br><strong>Lubriplate Quality Team</strong><br>rarora@lubriplate.com</p>
      </div>
      ${FOOTER}</div>`
  });
}

async function sendDocumentExpiryEmail(doc, supplierEmail) {
  const rmList = (() => { try { return JSON.parse(doc.raw_materials||'[]').join(', '); } catch { return doc.raw_materials||'N/A'; } })();
  await sendEmail({
    to: supplierEmail,
    subject: `Document Expiry Notice — ${doc.file_name}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      ${HEADER}
      <div style="padding:30px;background:#f9f9f9;">
        <h2 style="color:#CC0000;">Document Expiry Notice</h2>
        <p>Dear ${doc.supplier_name},</p>
        <p>The following compliance document has expired or is about to expire:</p>
        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:20px;margin:20px 0;">
          <p><strong>Document:</strong> ${doc.file_name}</p>
          <p><strong>Type:</strong> ${doc.document_type||'N/A'}</p>
          <p><strong>Raw Materials:</strong> ${rmList}</p>
          <p><strong>Expiry Date:</strong> ${doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : 'N/A'}</p>
        </div>
        <p>Please submit an updated document at your earliest convenience.</p>
        <p style="margin-top:30px;">Best regards,<br><strong>Lubriplate Quality Team</strong><br>rarora@lubriplate.com</p>
      </div>
      ${FOOTER}</div>`
  });
}

module.exports = { sendConfirmationEmail, sendTeamNotificationEmail, sendSupplierRequestEmail, sendDocumentExpiryEmail };
