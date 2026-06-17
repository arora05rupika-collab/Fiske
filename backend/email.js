const nodemailer = require('nodemailer');

// Configure transporter - uses ethereal/test account if no SMTP configured
async function getTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Create test account for development (Ethereal)
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
  } catch (e) {
    // Ethereal unreachable — return a no-op transporter so callers don't crash
    return {
      sendMail: async () => { throw new Error('No SMTP configured and Ethereal test service is unreachable. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.'); }
    };
  }
}

async function sendConfirmationEmail(submission, products) {
  const transporter = await getTransporter();
  const productList = products.map(p => `• ${p.product_name} (${p.product_type})`).join('\n');

  const info = await transporter.sendMail({
    from: '"Lubriplate Compliance Portal" <noreply@lubriplate.com>',
    to: submission.contact_email,
    subject: `Compliance Submission Received — Ref: ${submission.reference_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A1A1A; padding: 20px; text-align: center;">
          <h1 style="color: #CC0000; margin: 0;">LUBRIPLATE</h1>
          <p style="color: #ffffff; margin: 5px 0 0;">Lubricants Company</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1A1A1A;">Submission Confirmed ✓</h2>
          <p>Dear ${submission.contact_name},</p>
          <p>Thank you for submitting your compliance information. Your submission has been received and is under review.</p>

          <div style="background: #ffffff; border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #CC0000; margin-top: 0;">Submission Details</h3>
            <p><strong>Reference Number:</strong> ${submission.reference_number}</p>
            <p><strong>Company:</strong> ${submission.company_name}</p>
            <p><strong>Submitted:</strong> ${new Date(submission.submission_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Products Submitted:</strong></p>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${products.map(p => `<li>${p.product_name} (${p.product_type})</li>`).join('')}
            </ul>
          </div>

          <p>Our quality team will review your submission and may contact you if additional information is required.</p>
          <p>Please keep your reference number for future correspondence: <strong>${submission.reference_number}</strong></p>

          <p style="margin-top: 30px;">Best regards,<br>
          <strong>Lubriplate Quality Team</strong><br>
          rarora@lubriplate.com</p>
        </div>
        <div style="background: #1A1A1A; padding: 15px; text-align: center;">
          <p style="color: #888; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Lubriplate Lubricants Company. All rights reserved.</p>
        </div>
      </div>
    `
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('Confirmation email preview URL:', nodemailer.getTestMessageUrl(info));
  }
  return info;
}

async function sendTeamNotificationEmail(submission, products) {
  const transporter = await getTransporter();
  const dashboardUrl = process.env.DASHBOARD_URL || `http://localhost:${process.env.PORT || 3001}/admin`;

  const info = await transporter.sendMail({
    from: '"Lubriplate Compliance Portal" <noreply@lubriplate.com>',
    to: 'rarora@lubriplate.com',
    subject: `New Compliance Submission — ${submission.company_name} (${submission.reference_number})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A1A1A; padding: 20px; text-align: center;">
          <h1 style="color: #CC0000; margin: 0;">LUBRIPLATE</h1>
          <p style="color: #ffffff; margin: 5px 0 0;">Compliance Portal — Internal Notification</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1A1A1A;">New Supplier Submission Received</h2>

          <div style="background: #ffffff; border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p><strong>Reference:</strong> ${submission.reference_number}</p>
            <p><strong>Company:</strong> ${submission.company_name}</p>
            <p><strong>Contact:</strong> ${submission.contact_name} (${submission.contact_email})</p>
            <p><strong>Country:</strong> ${submission.country || 'Not specified'}</p>
            <p><strong>Products:</strong> ${products.length}</p>
            <ul>
              ${products.map(p => `<li>${p.product_name} — ${p.product_type}</li>`).join('')}
            </ul>
            <p><strong>Submitted:</strong> ${new Date(submission.submission_date).toLocaleString()}</p>
          </div>

          <a href="${dashboardUrl}" style="display: inline-block; background: #CC0000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View in Dashboard →
          </a>
        </div>
        <div style="background: #1A1A1A; padding: 15px; text-align: center;">
          <p style="color: #888; margin: 0; font-size: 12px;">Lubriplate Lubricants Supplier Compliance Portal</p>
        </div>
      </div>
    `
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('Team notification email preview URL:', nodemailer.getTestMessageUrl(info));
  }
  return info;
}

async function sendSupplierRequestEmail(supplier) {
  const transporter = await getTransporter();
  const materials = supplier.materials || [];
  const materialRows = materials.map(m =>
    `<tr><td style="padding:6px 12px;border:1px solid #ddd;">${m.id}</td><td style="padding:6px 12px;border:1px solid #ddd;">${m.name}</td><td style="padding:6px 12px;border:1px solid #ddd;">${m.type}</td></tr>`
  ).join('');
  const info = await transporter.sendMail({
    from: '"Lubriplate Compliance Portal" <noreply@lubriplate.com>',
    to: supplier.contact_email,
    subject: `Compliance Document Request — Lubriplate Lubricants`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A1A1A; padding: 20px; text-align: center;">
          <h1 style="color: #CC0000; margin: 0;">LUBRIPLATE</h1>
          <p style="color: #ffffff; margin: 5px 0 0;">Lubricants Company</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1A1A1A;">Compliance Document Request</h2>
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
          <p style="margin-top: 30px;">Best regards,<br>
          <strong>Lubriplate Quality Team</strong><br>
          rarora@lubriplate.com</p>
        </div>
        <div style="background: #1A1A1A; padding: 15px; text-align: center;">
          <p style="color: #888; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Lubriplate Lubricants Company. All rights reserved.</p>
        </div>
      </div>
    `
  });
  if (process.env.NODE_ENV !== 'production') {
    console.log('Supplier request email preview URL:', nodemailer.getTestMessageUrl(info));
  }
  return info;
}

async function sendDocumentExpiryEmail(doc, supplierEmail) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: '"Lubriplate Compliance Portal" <noreply@lubriplate.com>',
    to: supplierEmail,
    subject: `Document Expiry Notice — ${doc.file_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A1A1A; padding: 20px; text-align: center;">
          <h1 style="color: #CC0000; margin: 0;">LUBRIPLATE</h1>
          <p style="color: #ffffff; margin: 5px 0 0;">Lubricants Company</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #CC0000;">Document Expiry Notice</h2>
          <p>Dear ${doc.supplier_name},</p>
          <p>This is an automated notice that the following compliance document has expired or is about to expire:</p>
          <div style="background: #ffffff; border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p><strong>Document:</strong> ${doc.file_name}</p>
            <p><strong>Document Type:</strong> ${doc.document_type || 'N/A'}</p>
            <p><strong>Raw Materials:</strong> ${(() => { try { return JSON.parse(doc.raw_materials || '[]').join(', '); } catch(e) { return doc.raw_materials || 'N/A'; } })()}</p>
            <p><strong>Expiry Date:</strong> ${doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
          </div>
          <p>Please submit an updated document at your earliest convenience to maintain your compliance status.</p>
          <p style="margin-top: 30px;">Best regards,<br>
          <strong>Lubriplate Quality Team</strong><br>
          rarora@lubriplate.com</p>
        </div>
        <div style="background: #1A1A1A; padding: 15px; text-align: center;">
          <p style="color: #888; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Lubriplate Lubricants Company. All rights reserved.</p>
        </div>
      </div>
    `
  });
  if (process.env.NODE_ENV !== 'production') {
    console.log('Expiry notification email preview URL:', nodemailer.getTestMessageUrl(info));
  }
  return info;
}

module.exports = { sendConfirmationEmail, sendTeamNotificationEmail, sendSupplierRequestEmail, sendDocumentExpiryEmail };
