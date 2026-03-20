const nodemailer = require('nodemailer');

// Configure transporter - uses ethereal/test account if no SMTP configured
async function getTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Create test account for development
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransporter({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
  return transporter;
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
          quality@lubriplate.com</p>
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
    to: 'quality@lubriplate.com',
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

module.exports = { sendConfirmationEmail, sendTeamNotificationEmail };
