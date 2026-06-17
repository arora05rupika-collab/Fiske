const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'lubriplate.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS SupplierSubmissions (
      id TEXT PRIMARY KEY,
      company_name TEXT,
      contact_name TEXT,
      contact_email TEXT,
      country TEXT,
      regulatory_compliant TEXT,
      regulatory_penalties TEXT,
      penalty_details TEXT,
      kosher_cert_na INTEGER DEFAULT 0,
      kosher_cert_expiry TEXT,
      kosher_cert_body TEXT,
      kosher_cert_file_path TEXT,
      halal_cert_na INTEGER DEFAULT 0,
      halal_cert_expiry TEXT,
      halal_cert_body TEXT,
      halal_cert_file_path TEXT,
      cross_contamination_procedures TEXT,
      wheat_starch_packaging TEXT,
      signatory_name TEXT,
      signatory_title TEXT,
      signature_image_path TEXT,
      submission_date TEXT,
      status TEXT DEFAULT 'Submitted',
      reference_number TEXT,
      eu_compliance_data TEXT,
      step_completed INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS SupplierProducts (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      product_name TEXT,
      product_type TEXT,
      pfas_free TEXT,
      moah_free TEXT,
      sds_file_path TEXT,
      tds_file_path TEXT,
      nsf_cert_file_path TEXT,
      nsf_cert_expiry TEXT,
      nsf_registration_number TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (submission_id) REFERENCES SupplierSubmissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS SupplierAllergens (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      allergen_code TEXT,
      allergen_label TEXT,
      in_product TEXT DEFAULT 'N/A',
      same_line TEXT DEFAULT 'N/A',
      same_plant TEXT DEFAULT 'N/A',
      FOREIGN KEY (product_id) REFERENCES SupplierProducts(id) ON DELETE CASCADE,
      FOREIGN KEY (submission_id) REFERENCES SupplierSubmissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS RawMaterials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'Industrial',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      raw_materials TEXT DEFAULT '[]',
      contact_email TEXT,
      vendor_type TEXT DEFAULT 'Preferred Supplier',
      status TEXT DEFAULT 'Under Review',
      comments TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS RawMaterialDocs (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_path TEXT,
      document_type TEXT,
      raw_materials TEXT DEFAULT '[]',
      expiry_date TEXT,
      supplier_id TEXT,
      supplier_name TEXT,
      expiry_notified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { getDb };
