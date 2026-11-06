const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { sendConfirmationEmail, sendTeamNotificationEmail } = require('../email');
const sharepoint = require('../sharepoint');

function uniqueFilename(req, file, cb) {
  const ext = path.extname(file.originalname);
  const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
  cb(null, `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
}

function allowedFileTypes(req, file, cb) {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('File type not allowed. Please upload a PDF, JPG, PNG, DOC or DOCX file.'));
}

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
    const { company_name, contact_name, contact_email, country, products, quality_certified, quality_certifications, supplier_id } = req.body;

    if (!company_name || !contact_name || !contact_email) {
      return res.status(400).json({ error: 'Company name, contact name and email are required' });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'At least one product is required' });
    }

    const ref = generateRef();
    const knownSupplier = supplier_id ? db.prepare('SELECT id FROM Suppliers WHERE id = ?').get(supplier_id) : null;

    db.prepare(`
      INSERT INTO SupplierSubmissions (id, company_name, contact_name, contact_email, country, reference_number, step_completed,
        status, quality_certified, quality_certifications, supplier_id)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'In Progress', ?, ?, ?)
    `).run(
      id, company_name, contact_name, contact_email, country || null, ref,
      quality_certified || null,
      quality_certified === 'Yes' ? (quality_certifications || null) : null,
      knownSupplier ? knownSupplier.id : null
    );

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

// Step 1 (returning via Back): update company details and products, keeping saved product data
router.patch('/:id/step1', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { company_name, contact_name, contact_email, country, products, quality_certified, quality_certifications } = req.body;

    const submission = db.prepare('SELECT * FROM SupplierSubmissions WHERE id = ?').get(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.submission_date) return res.status(400).json({ error: 'This form has already been submitted.' });
    if (!company_name || !contact_name || !contact_email) {
      return res.status(400).json({ error: 'Company name, contact name and email are required' });
    }
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'At least one product is required' });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE SupplierSubmissions SET company_name = ?, contact_name = ?, contact_email = ?, country = ?,
          quality_certified = ?, quality_certifications = ?
        WHERE id = ?
      `).run(
        company_name, contact_name, contact_email, country || null,
        quality_certified || null, quality_certified === 'Yes' ? (quality_certifications || null) : null, id
      );

      const existingIds = new Set(db.prepare('SELECT id FROM SupplierProducts WHERE submission_id = ?').all(id).map(r => r.id));
      const keptIds = new Set();
      products.forEach((p, index) => {
        if (p.id && existingIds.has(p.id)) {
          keptIds.add(p.id);
          db.prepare('UPDATE SupplierProducts SET product_name = ?, product_type = ?, sort_order = ? WHERE id = ?')
            .run(p.product_name, p.product_type, index, p.id);
        } else {
          db.prepare('INSERT INTO SupplierProducts (id, submission_id, product_name, product_type, sort_order) VALUES (?, ?, ?, ?, ?)')
            .run(uuidv4(), id, p.product_name, p.product_type, index);
        }
      });
      existingIds.forEach(pid => {
        if (!keptIds.has(pid)) db.prepare('DELETE FROM SupplierProducts WHERE id = ?').run(pid);
      });
    })();

    const saved = db.prepare('SELECT * FROM SupplierProducts WHERE submission_id = ? ORDER BY sort_order').all(id);
    res.json({ id, reference_number: submission.reference_number, products: saved });
  } catch (err) {
    console.error('Step 1 update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Save one product's documents and answers
const productUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const safe = (s) => String(s).replace(/[^a-zA-Z0-9-_]/g, '_');
      const dir = path.join(__dirname, '..', 'uploads', safe(req.params.id), safe(req.params.pid));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: uniqueFilename,
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: allowedFileTypes,
}).fields([
  ...['sds_file', 'tds_file', 'halal_cert_file', 'kosher_cert_file', 'pfas_file', 'moah_file'].map(name => ({ name, maxCount: 1 })),
  { name: 'nsf_cert_files', maxCount: 10 },
]);

function handleProductUpload(req, res, next) {
  productUpload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'One of the files is too large. The maximum size is 20MB.' : err.message;
    res.status(400).json({ error: message });
  });
}

router.patch('/:id/products/:pid', handleProductUpload, (req, res) => {
  try {
    const db = getDb();
    const { id, pid } = req.params;
    const body = req.body;
    const files = req.files || {};

    const product = db.prepare('SELECT * FROM SupplierProducts WHERE id = ? AND submission_id = ?').get(pid, id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const filePath = (key) => files[key]?.[0]
      ? files[key][0].path.replace(path.join(__dirname, '..'), '').split(path.sep).join('/')
      : null;

    const halal = body.halal_certified || null;
    const kosher = body.kosher_certified || null;

    // New NSF uploads replace the previous set (a supplier may have several NSF categories)
    const nsfPaths = (files.nsf_cert_files || []).map(f => f.path.replace(path.join(__dirname, '..'), '').split(path.sep).join('/'));
    const nsfFilesJson = nsfPaths.length ? JSON.stringify(nsfPaths) : null;
    const hasNsf = nsfPaths.length > 0 || !!product.nsf_cert_file_path;
    const nsfExpiry = hasNsf ? (product.nsf_cert_expiry || nsfExpiryFrom(new Date())) : null;

    db.prepare(`
      UPDATE SupplierProducts SET
        pfas_free = ?, pfas_file_path = COALESCE(?, pfas_file_path),
        moah_free = ?, moah_file_path = COALESCE(?, moah_file_path),
        sds_file_path = COALESCE(?, sds_file_path),
        tds_file_path = COALESCE(?, tds_file_path),
        nsf_cert_file_path = COALESCE(?, nsf_cert_file_path),
        nsf_cert_files = COALESCE(?, nsf_cert_files),
        nsf_cert_expiry = ?, nsf_registration_number = ?,
        halal_certified = ?, halal_cert_file_path = COALESCE(?, halal_cert_file_path), halal_cert_expiry = ?,
        kosher_certified = ?, kosher_cert_file_path = COALESCE(?, kosher_cert_file_path), kosher_cert_expiry = ?
      WHERE id = ?
    `).run(
      body.pfas_free || null, filePath('pfas_file'),
      body.moah_free || null, filePath('moah_file'),
      filePath('sds_file'),
      filePath('tds_file'),
      nsfPaths[0] || null,
      nsfFilesJson,
      nsfExpiry, body.nsf_registration_number || null,
      halal, filePath('halal_cert_file'), halal === 'Yes' ? (body.halal_cert_expiry || null) : null,
      kosher, filePath('kosher_cert_file'), kosher === 'Yes' ? (body.kosher_cert_expiry || null) : null,
      pid
    );

    db.prepare('UPDATE SupplierSubmissions SET step_completed = MAX(step_completed, 2) WHERE id = ?').run(id);

    res.json({ success: true, product: db.prepare('SELECT * FROM SupplierProducts WHERE id = ?').get(pid) });
  } catch (err) {
    console.error('Product save error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Step 3: Save allergen data
router.patch('/:id/step3', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { allergens, allergens_in_products, allergens_in_plant, cross_contamination_procedures, wheat_starch_packaging } = req.body;

    const submission = db.prepare('SELECT * FROM SupplierSubmissions WHERE id = ?').get(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    db.prepare(`
      UPDATE SupplierSubmissions SET
        allergens_in_products = ?,
        allergens_in_plant = ?,
        cross_contamination_procedures = ?,
        wheat_starch_packaging = ?,
        step_completed = 3
      WHERE id = ?
    `).run(allergens_in_products || null, allergens_in_plant || null, cross_contamination_procedures || null, wheat_starch_packaging || null, id);

    // Delete existing allergens for this submission
    db.prepare('DELETE FROM SupplierAllergens WHERE submission_id = ?').run(id);

    // Insert new allergen data
    if (allergens_in_products === 'Yes' && Array.isArray(allergens)) {
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

// Step 4: Regulatory declarations (REACH, RoHS, Conflict Minerals, Melamine, PBT, POPs, PPWR)
router.patch('/:id/step4-compliance', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { rohs_data, svhc_data, declarations } = req.body;

    const submission = db.prepare('SELECT * FROM SupplierSubmissions WHERE id = ?').get(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const complianceData = JSON.stringify({ rohs_data, svhc_data, declarations });

    db.prepare(`
      UPDATE SupplierSubmissions SET
        eu_compliance_data = ?,
        step_completed = 4
      WHERE id = ?
    `).run(complianceData, id);

    res.json({ success: true, id });
  } catch (err) {
    console.error('Step 4 compliance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Step 5: Final submission with signature
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

    // NSF certificates are valid for three years from the submission date
    db.prepare(`UPDATE SupplierProducts SET nsf_cert_expiry = ? WHERE submission_id = ? AND nsf_cert_file_path IS NOT NULL`)
      .run(nsfExpiryFrom(new Date(submissionDate)), id);

    db.prepare(`
      UPDATE SupplierSubmissions SET
        signatory_name = ?,
        signatory_title = ?,
        signature_image_path = COALESCE(?, signature_image_path),
        submission_date = ?,
        status = 'Submitted',
        step_completed = 5
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

    // File every submitted document into the Raw Material Docs library
    try {
      fileSubmissionDocs(db, updatedSubmission, products);
    } catch (docErr) {
      console.error('Doc library populate error (non-fatal):', docErr.message);
    }

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

    // Parse EU compliance data
    let euCompliance = {};
    if (submission.eu_compliance_data) {
      try { euCompliance = JSON.parse(submission.eu_compliance_data); } catch (e) { /* ignore */ }
    }

    res.json({ ...submission, ...euCompliance, products, allergens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function nsfExpiryFrom(date) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().split('T')[0];
}

function nsfFilesOf(product) {
  let list = [];
  try { list = JSON.parse(product.nsf_cert_files || '[]'); } catch { /* ignore */ }
  if (list.length === 0 && product.nsf_cert_file_path) list = [product.nsf_cert_file_path];
  return list;
}

function findSupplierForSubmission(db, submission) {
  if (submission.supplier_id) {
    const byId = db.prepare('SELECT * FROM Suppliers WHERE id = ?').get(submission.supplier_id);
    if (byId) return byId;
  }
  if (submission.contact_email) {
    const byEmail = db.prepare('SELECT * FROM Suppliers WHERE LOWER(TRIM(contact_email)) = LOWER(TRIM(?))').get(submission.contact_email);
    if (byEmail) return byEmail;
  }
  return db.prepare('SELECT * FROM Suppliers WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(submission.company_name || '') || null;
}

function fileSubmissionDocs(db, submission, products) {
  const supplier = findSupplierForSubmission(db, submission);
  const supplierId = supplier ? supplier.id : '';
  const supplierName = supplier ? supplier.name : (submission.company_name || '');

  const supplierRmIds = supplier ? (() => { try { return JSON.parse(supplier.raw_materials || '[]'); } catch { return []; } })() : [];
  const allRM = db.prepare('SELECT * FROM RawMaterials').all();
  const rmCodeFor = (productName) => {
    const name = (productName || '').trim().toLowerCase();
    const matches = allRM.filter(m => m.name.trim().toLowerCase() === name);
    const preferred = matches.find(m => supplierRmIds.includes(m.id)) || matches[0];
    return JSON.stringify(preferred ? [preferred.id] : []);
  };

  const insertDoc = db.prepare(`
    INSERT INTO RawMaterialDocs (id, file_name, file_path, document_type, raw_materials, expiry_date, supplier_id, supplier_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  products.forEach(product => {
    const rm = rmCodeFor(product.product_name);
    const docs = [
      [product.sds_file_path, 'SDS', 'SDS (Safety Data Sheet)', null],
      [product.tds_file_path, 'TDS', 'TDS (Technical Data Sheet)', null],
      [product.halal_certified === 'Yes' && product.halal_cert_file_path, 'Halal Certificate', 'Halal Certificate', product.halal_cert_expiry],
      [product.kosher_certified === 'Yes' && product.kosher_cert_file_path, 'Kosher Certificate', 'Kosher Certificate', product.kosher_cert_expiry],
      [product.pfas_file_path, 'PFAS Statement', 'PFAS Statement', null],
      [product.moah_file_path, 'MOAH Statement', 'MOAH Statement', null],
    ];
    nsfFilesOf(product).forEach((nsfPath, i, all) => {
      docs.push([nsfPath, all.length > 1 ? `NSF Certificate ${i + 1}` : 'NSF Certificate', 'NSF Certificate', product.nsf_cert_expiry]);
    });
    docs.forEach(([filePath, label, docType, expiry]) => {
      if (!filePath) return;
      insertDoc.run(uuidv4(), `${product.product_name} - ${label}`, filePath, docType, rm, expiry || null, supplierId, supplierName);
    });
  });
}

module.exports = router;
