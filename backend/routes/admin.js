const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const XLSX = require('xlsx');
const { sendSupplierRequestEmail, sendDocumentExpiryEmail } = require('../email');

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'raw-material-docs');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 20 * 1024 * 1024 } });

function nextRCode(db) {
  const last = db.prepare("SELECT id FROM RawMaterials ORDER BY CAST(SUBSTR(id,2) AS INTEGER) DESC LIMIT 1").get();
  const n = last ? parseInt(last.id.substring(1)) + 1 : 1;
  return `R${String(n).padStart(3, '0')}`;
}

// ─── Raw Materials (global list) ──────────────────────────────────────────────

router.get('/raw-materials', (req, res) => {
  try {
    const db = getDb();
    res.json(db.prepare('SELECT * FROM RawMaterials ORDER BY id ASC').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/raw-materials', (req, res) => {
  try {
    const db = getDb();
    const { name, type, id: manualId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!manualId || !manualId.trim()) return res.status(400).json({ error: 'R-code is required' });
    const rcode = manualId.trim().toUpperCase();
    if (!/^R\d+$/.test(rcode)) return res.status(400).json({ error: 'R-code must be R followed by digits (e.g. R001)' });
    const taken = db.prepare('SELECT id FROM RawMaterials WHERE id = ?').get(rcode);
    if (taken) return res.status(400).json({ error: `R-code ${rcode} is already in use` });
    const nameTaken = db.prepare('SELECT id FROM RawMaterials WHERE LOWER(name) = LOWER(?)').get(name.trim());
    if (nameTaken) return res.json({ id: nameTaken.id, existing: true });
    db.prepare('INSERT INTO RawMaterials (id, name, type) VALUES (?, ?, ?)').run(rcode, name.trim(), type || 'Industrial');
    res.json({ id: rcode, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/raw-materials/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, type } = req.body;
    const cur = db.prepare('SELECT * FROM RawMaterials WHERE id = ?').get(req.params.id);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE RawMaterials SET name=?, type=? WHERE id=?').run(name ?? cur.name, type ?? cur.type, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/raw-materials/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM RawMaterials WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public prefill endpoint (no auth) — returns supplier info for pre-filling the compliance form
router.get('/suppliers/prefill/:id', (req, res) => {
  try {
    const db = getDb();
    const supplier = db.prepare('SELECT * FROM Suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Not found' });
    const rmIds = (() => { try { return JSON.parse(supplier.raw_materials || '[]'); } catch { return []; } })();
    const materials = rmIds.length
      ? db.prepare(`SELECT * FROM RawMaterials WHERE id IN (${rmIds.map(() => '?').join(',')})`)
          .all(...rmIds)
      : [];
    res.json({
      company_name: supplier.name,
      contact_email: supplier.contact_email,
      products: materials.map(m => ({ product_name: m.name, product_type: m.type }))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// All admin routes require authentication
router.use(authenticateToken);

// GET all submissions with filters
router.get('/submissions', (req, res) => {
  try {
    const db = getDb();
    const { status, search, product_type, date_from, date_to } = req.query;

    let query = `
      SELECT
        s.id, s.company_name, s.contact_email, s.contact_name, s.country,
        s.submission_date, s.status, s.reference_number, s.step_completed,
        s.created_at,
        COUNT(p.id) as product_count,
        GROUP_CONCAT(DISTINCT p.product_type) as product_types
      FROM SupplierSubmissions s
      LEFT JOIN SupplierProducts p ON p.submission_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (s.company_name LIKE ? OR s.contact_email LIKE ? OR s.reference_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (product_type) {
      query += ' AND EXISTS (SELECT 1 FROM SupplierProducts pp WHERE pp.submission_id = s.id AND pp.product_type = ?)';
      params.push(product_type);
    }
    if (date_from) {
      query += ' AND s.submission_date >= ?';
      params.push(date_from);
    }
    if (date_to) {
      query += ' AND s.submission_date <= ?';
      params.push(date_to + 'T23:59:59');
    }

    query += ' GROUP BY s.id ORDER BY s.created_at DESC';

    const submissions = db.prepare(query).all(...params);
    res.json(submissions);
  } catch (err) {
    console.error('Admin submissions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single submission detail
router.get('/submissions/:id', (req, res) => {
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

// PATCH update submission status
router.patch('/submissions/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    const validStatuses = ['Submitted', 'Under Review', 'Approved', 'Rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = db.prepare('UPDATE SupplierSubmissions SET status = ? WHERE id = ?').run(status, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE submission permanently
router.delete('/submissions/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM SupplierSubmissions WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH archive/restore submission (soft delete)
router.patch('/submissions/:id/archive', (req, res) => {
  try {
    const db = getDb();
    const { archived } = req.body;
    const result = db.prepare('UPDATE SupplierSubmissions SET status = ? WHERE id = ?')
      .run(archived ? 'Archived' : 'Submitted', req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, status: archived ? 'Archived' : 'Submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET export to CSV/Excel
router.get('/export', (req, res) => {
  try {
    const db = getDb();
    const { format = 'xlsx', status, date_from, date_to } = req.query;

    let query = `
      SELECT
        s.reference_number, s.company_name, s.contact_name, s.contact_email,
        s.country, s.submission_date, s.status,
        s.regulatory_compliant, s.regulatory_penalties, s.penalty_details,
        s.kosher_cert_na, s.halal_cert_na,
        s.cross_contamination_procedures, s.wheat_starch_packaging,
        s.signatory_name, s.signatory_title,
        COUNT(p.id) as product_count,
        GROUP_CONCAT(p.product_name, ' | ') as products,
        GROUP_CONCAT(DISTINCT p.product_type) as product_types
      FROM SupplierSubmissions s
      LEFT JOIN SupplierProducts p ON p.submission_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND s.status = ?'; params.push(status); }
    if (date_from) { query += ' AND s.submission_date >= ?'; params.push(date_from); }
    if (date_to) { query += ' AND s.submission_date <= ?'; params.push(date_to + 'T23:59:59'); }

    query += ' GROUP BY s.id ORDER BY s.created_at DESC';

    const rows = db.prepare(query).all(...params);

    const headers = [
      'Reference #', 'Company Name', 'Contact Name', 'Email', 'Country',
      'Submission Date', 'Status', 'Products', 'Product Types', 'Product Count',
      'Regulatory Compliant', 'Regulatory Penalties', 'Penalty Details',
      'Kosher N/A', 'Halal N/A', 'Cross-Contamination Procedures', 'Wheat Starch Packaging',
      'Signatory Name', 'Signatory Title'
    ];

    const data = rows.map(r => [
      r.reference_number, r.company_name, r.contact_name, r.contact_email,
      r.country, r.submission_date ? new Date(r.submission_date).toLocaleDateString() : '',
      r.status, r.products, r.product_types, r.product_count,
      r.regulatory_compliant, r.regulatory_penalties, r.penalty_details,
      r.kosher_cert_na ? 'Yes' : 'No', r.halal_cert_na ? 'Yes' : 'No',
      r.cross_contamination_procedures, r.wheat_starch_packaging,
      r.signatory_name, r.signatory_title
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Column widths
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Submissions');

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="submissions.csv"');
      return res.send(csv);
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="submissions.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

router.get('/suppliers', (req, res) => {
  try {
    const db = getDb();
    const suppliers = db.prepare('SELECT * FROM Suppliers ORDER BY created_at DESC').all();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suppliers', (req, res) => {
  try {
    const db = getDb();
    const { name, raw_materials, contact_email, vendor_type, status, comments } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = uuidv4();
    db.prepare(`
      INSERT INTO Suppliers (id, name, raw_materials, contact_email, vendor_type, status, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, JSON.stringify(raw_materials || []), contact_email || '', vendor_type || 'Preferred Supplier', status || 'Under Review', comments || '');
    res.json({ id, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/suppliers/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, raw_materials, contact_email, vendor_type, status, comments } = req.body;
    const current = db.prepare('SELECT * FROM Suppliers WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });
    db.prepare(`
      UPDATE Suppliers SET name=?, raw_materials=?, contact_email=?, vendor_type=?, status=?, comments=? WHERE id=?
    `).run(
      name ?? current.name,
      raw_materials !== undefined ? JSON.stringify(raw_materials) : current.raw_materials,
      contact_email ?? current.contact_email,
      vendor_type ?? current.vendor_type,
      status ?? current.status,
      comments ?? current.comments,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/suppliers/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM Suppliers WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suppliers/:id/send-request', async (req, res) => {
  try {
    const db = getDb();
    const supplier = db.prepare('SELECT * FROM Suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Not found' });
    if (!supplier.contact_email) return res.status(400).json({ error: 'Supplier has no contact email' });
    const rmIds = (() => { try { return JSON.parse(supplier.raw_materials || '[]'); } catch { return []; } })();
    const materials = rmIds.length
      ? db.prepare(`SELECT * FROM RawMaterials WHERE id IN (${rmIds.map(() => '?').join(',')})`)
          .all(...rmIds)
      : [];
    let emailSent = false;
    let emailError = null;
    try {
      await sendSupplierRequestEmail({ ...supplier, materials });
      emailSent = true;
    } catch (emailErr) {
      emailError = emailErr.message;
      console.error('Supplier request email error:', emailErr.message);
    }
    db.prepare("UPDATE Suppliers SET status = 'Sent Request' WHERE id = ?").run(req.params.id);
    res.json({ success: true, emailSent, message: emailSent ? 'Request sent and email delivered.' : `Status updated but email failed: ${emailError}` });
  } catch (err) {
    console.error('Send request error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Raw Material Docs ────────────────────────────────────────────────────────

router.get('/raw-material-docs', (req, res) => {
  try {
    const db = getDb();
    const docs = db.prepare('SELECT * FROM RawMaterialDocs ORDER BY created_at DESC').all();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/raw-material-docs', uploadDoc.single('file'), (req, res) => {
  try {
    const db = getDb();
    const { document_type, raw_materials, expiry_date, supplier_id, supplier_name } = req.body;
    const id = uuidv4();
    const file_name = req.file ? req.file.originalname : req.body.file_name || '';
    const file_path = req.file ? `/uploads/raw-material-docs/${req.file.filename}` : '';
    db.prepare(`
      INSERT INTO RawMaterialDocs (id, file_name, file_path, document_type, raw_materials, expiry_date, supplier_id, supplier_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, file_name, file_path, document_type || '', JSON.stringify(raw_materials ? (Array.isArray(raw_materials) ? raw_materials : [raw_materials]) : []), expiry_date || '', supplier_id || '', supplier_name || '');
    res.json({ id, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/raw-material-docs/:id', (req, res) => {
  try {
    const db = getDb();
    const { document_type, raw_materials, expiry_date, supplier_id, supplier_name } = req.body;
    const current = db.prepare('SELECT * FROM RawMaterialDocs WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });
    db.prepare(`
      UPDATE RawMaterialDocs SET document_type=?, raw_materials=?, expiry_date=?, supplier_id=?, supplier_name=?, expiry_notified=0 WHERE id=?
    `).run(
      document_type ?? current.document_type,
      raw_materials !== undefined ? JSON.stringify(Array.isArray(raw_materials) ? raw_materials : [raw_materials]) : current.raw_materials,
      expiry_date ?? current.expiry_date,
      supplier_id ?? current.supplier_id,
      supplier_name ?? current.supplier_name,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/raw-material-docs/:id', (req, res) => {
  try {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM RawMaterialDocs WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.file_path) {
      const fullPath = path.join(__dirname, '..', doc.file_path.replace(/^\//, ''));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    db.prepare('DELETE FROM RawMaterialDocs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/raw-material-docs/check-expiry', async (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const expired = db.prepare(`
      SELECT d.*, s.contact_email
      FROM RawMaterialDocs d
      LEFT JOIN Suppliers s ON s.id = d.supplier_id
      WHERE d.expiry_date <= ? AND d.expiry_notified = 0 AND d.expiry_date != ''
    `).all(today);

    let notified = 0;
    for (const doc of expired) {
      const email = doc.contact_email;
      if (!email) continue;
      try {
        await sendDocumentExpiryEmail(doc, email);
        db.prepare('UPDATE RawMaterialDocs SET expiry_notified = 1 WHERE id = ?').run(doc.id);
        notified++;
      } catch (e) {
        console.error(`Failed to notify expiry for doc ${doc.id}:`, e.message);
      }
    }
    res.json({ success: true, checked: expired.length, notified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
