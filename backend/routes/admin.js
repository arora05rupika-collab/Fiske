const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const XLSX = require('xlsx');

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

module.exports = router;
