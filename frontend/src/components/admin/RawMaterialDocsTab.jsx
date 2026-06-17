import React, { useState, useEffect } from 'react';
import { getRawMaterialDocs, createRawMaterialDoc, updateRawMaterialDoc, deleteRawMaterialDoc, checkDocExpiry, getSuppliers } from '../../api/index';

const DOC_TYPES = ['SDS (Safety Data Sheet)', 'TDS (Technical Data Sheet)', 'NSF Certificate', 'Kosher Certificate', 'Halal Certificate', 'COA (Certificate of Analysis)', 'Regulatory Compliance', 'Other'];

const emptyForm = { document_type: '', raw_materials: '', expiry_date: '', supplier_id: '', supplier_name: '', file: null };

function isExpired(date) {
  if (!date) return false;
  return new Date(date) < new Date();
}

function isExpiringSoon(date) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const diff = (d - now) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

export default function RawMaterialDocsTab() {
  const [docs, setDocs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checkingExpiry, setCheckingExpiry] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [docsRes, suppRes] = await Promise.all([getRawMaterialDocs(), getSuppliers()]);
      setDocs(docsRes.data);
      setSuppliers(suppRes.data);
    } catch {
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError(''); };
  const openEdit = (d) => {
    const mats = (() => { try { return JSON.parse(d.raw_materials || '[]').join(', '); } catch { return ''; } })();
    setForm({ document_type: d.document_type, raw_materials: mats, expiry_date: d.expiry_date || '', supplier_id: d.supplier_id || '', supplier_name: d.supplier_name || '', file: null });
    setEditingId(d.id);
    setShowForm(true);
    setError('');
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setError(''); };

  const handleSupplierSelect = (e) => {
    const id = e.target.value;
    const supp = suppliers.find(s => s.id === id);
    setForm(f => ({ ...f, supplier_id: id, supplier_name: supp ? supp.name : '' }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const raw_materials = form.raw_materials.split(',').map(s => s.trim()).filter(Boolean);
      if (editingId) {
        await updateRawMaterialDoc(editingId, { document_type: form.document_type, raw_materials, expiry_date: form.expiry_date, supplier_id: form.supplier_id, supplier_name: form.supplier_name });
      } else {
        const fd = new FormData();
        if (form.file) fd.append('file', form.file);
        else { setError('Please select a file.'); setSaving(false); return; }
        fd.append('document_type', form.document_type);
        raw_materials.forEach(m => fd.append('raw_materials', m));
        fd.append('expiry_date', form.expiry_date);
        fd.append('supplier_id', form.supplier_id);
        fd.append('supplier_name', form.supplier_name);
        await createRawMaterialDoc(fd);
      }
      await load();
      closeForm();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save document.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete document "${name}"?`)) return;
    try {
      await deleteRawMaterialDoc(id);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch {
      alert('Failed to delete document.');
    }
  };

  const handleCheckExpiry = async () => {
    setCheckingExpiry(true);
    try {
      const res = await checkDocExpiry();
      alert(`Expiry check complete. Checked: ${res.data.checked}, Notified: ${res.data.notified}`);
      await load();
    } catch {
      alert('Failed to run expiry check.');
    } finally {
      setCheckingExpiry(false);
    }
  };

  const parseMaterials = (raw) => { try { return JSON.parse(raw || '[]'); } catch { return []; } };

  const filtered = docs.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.file_name?.toLowerCase().includes(s) || d.supplier_name?.toLowerCase().includes(s) || d.document_type?.toLowerCase().includes(s);
  });

  return (
    <div className="raw-docs-tab">
      <div className="tab-section-header">
        <div>
          <h2 className="tab-section-title">Raw Material Documents</h2>
          <p className="tab-section-subtitle">All compliance documents from suppliers, with expiry tracking and auto-notifications</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={handleCheckExpiry} disabled={checkingExpiry} title="Check and notify for expired documents">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {checkingExpiry ? 'Checking...' : 'Check Expiry'}
          </button>
          <button className="btn btn-red" onClick={openAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Document
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Document' : 'Add Document'}</h3>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="form-error">{error}</div>}
              <div className="form-grid">
                {!editingId && (
                  <div className="form-field form-field-full">
                    <label>Upload File *</label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setForm(f => ({ ...f, file: e.target.files[0] }))} />
                  </div>
                )}
                <div className="form-field">
                  <label>Document Type</label>
                  <select value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}>
                    <option value="">Select type...</option>
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Expiry Date</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
                </div>
                <div className="form-field form-field-full">
                  <label>Raw Materials <span className="hint">(comma-separated)</span></label>
                  <input value={form.raw_materials} onChange={e => setForm(f => ({ ...f, raw_materials: e.target.value }))} placeholder="e.g. Base Oil, Additive A" />
                </div>
                <div className="form-field">
                  <label>Supplier</label>
                  <select value={form.supplier_id} onChange={handleSupplierSelect}>
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Supplier Name <span className="hint">(if not in list)</span></label>
                  <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="Or type supplier name" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="btn btn-red" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Upload Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="docs-search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search by file name, supplier, or document type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '36px' }}
        />
      </div>

      <div className="docs-folder-container">
        {loading ? (
          <div className="table-loading">
            <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '28px', height: '28px' }} />
            <span>Loading documents...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <p>{search ? 'No documents match your search.' : 'No documents uploaded yet. Click "Add Document" to get started.'}</p>
          </div>
        ) : (
          <div className="docs-grid">
            {filtered.map(d => {
              const expired = isExpired(d.expiry_date);
              const expiringSoon = !expired && isExpiringSoon(d.expiry_date);
              const materials = parseMaterials(d.raw_materials);
              return (
                <div key={d.id} className={`doc-card ${expired ? 'doc-expired' : expiringSoon ? 'doc-expiring' : ''}`}>
                  <div className="doc-card-header">
                    <div className="doc-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="doc-card-actions">
                      {d.file_path && (
                        <a href={d.file_path} target="_blank" rel="noreferrer" className="action-btn action-view" title="View file">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </a>
                      )}
                      <button className="action-btn action-edit" title="Edit" onClick={() => openEdit(d)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="action-btn action-delete" title="Delete" onClick={() => handleDelete(d.id, d.file_name)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="doc-file-name" title={d.file_name}>{d.file_name}</div>
                  <div className="doc-meta">
                    {d.document_type && (
                      <span className="doc-type-badge">{d.document_type}</span>
                    )}
                    {expired && <span className="expiry-badge expiry-red">Expired</span>}
                    {expiringSoon && <span className="expiry-badge expiry-yellow">Expiring Soon</span>}
                  </div>
                  <div className="doc-details">
                    <div className="doc-detail-row">
                      <span className="doc-detail-label">Supplier</span>
                      <span className="doc-detail-value">{d.supplier_name || '—'}</span>
                    </div>
                    {materials.length > 0 && (
                      <div className="doc-detail-row">
                        <span className="doc-detail-label">Raw Materials</span>
                        <div className="material-chips" style={{ marginTop: '2px' }}>
                          {materials.map((m, i) => <span key={i} className="material-chip">{m}</span>)}
                        </div>
                      </div>
                    )}
                    {d.expiry_date && (
                      <div className="doc-detail-row">
                        <span className="doc-detail-label">Expiry</span>
                        <span className={`doc-detail-value ${expired ? 'text-red' : expiringSoon ? 'text-yellow' : ''}`}>
                          {new Date(d.expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}
                    {d.expiry_notified === 1 && (
                      <div className="doc-detail-row">
                        <span className="doc-detail-label">Notified</span>
                        <span className="doc-detail-value" style={{ color: '#10b981' }}>✓ Supplier notified</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
