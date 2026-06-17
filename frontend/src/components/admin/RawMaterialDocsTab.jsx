import React, { useState, useEffect } from 'react';
import { getRawMaterialDocs, createRawMaterialDoc, updateRawMaterialDoc, deleteRawMaterialDoc, checkDocExpiry, getSuppliers, getRawMaterials } from '../../api/index';

const DOC_TYPES = ['SDS (Safety Data Sheet)', 'TDS (Technical Data Sheet)', 'NSF Certificate', 'Kosher Certificate', 'Halal Certificate', 'COA (Certificate of Analysis)', 'Regulatory Compliance', 'Other'];

const emptyForm = { document_type: '', raw_material_ids: [], expiry_date: '', supplier_id: '', supplier_name: '', file: null };

function isExpired(date) { return date && new Date(date) < new Date(); }
function isExpiringSoon(date) {
  if (!date) return false;
  const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

export default function RawMaterialDocsTab() {
  const [docs, setDocs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
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
      const [dRes, sRes, mRes] = await Promise.all([getRawMaterialDocs(), getSuppliers(), getRawMaterials()]);
      setDocs(dRes.data);
      setSuppliers(sRes.data);
      setAllMaterials(mRes.data);
    } catch { setError('Failed to load documents.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const parseRmIds = (raw) => { try { return JSON.parse(raw || '[]'); } catch { return []; } };

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError(''); };
  const openEdit = (d) => {
    setForm({ document_type: d.document_type, raw_material_ids: parseRmIds(d.raw_materials), expiry_date: d.expiry_date || '', supplier_id: d.supplier_id || '', supplier_name: d.supplier_name || '', file: null });
    setEditingId(d.id);
    setShowForm(true);
    setError('');
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setError(''); };

  const handleSupplierSelect = (e) => {
    const id = e.target.value;
    const s = suppliers.find(x => x.id === id);
    setForm(f => ({ ...f, supplier_id: id, supplier_name: s ? s.name : '' }));
  };

  const toggleRmId = (id) => {
    setForm(f => ({
      ...f,
      raw_material_ids: f.raw_material_ids.includes(id)
        ? f.raw_material_ids.filter(x => x !== id)
        : [...f.raw_material_ids, id]
    }));
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (editingId) {
        await updateRawMaterialDoc(editingId, { document_type: form.document_type, raw_materials: form.raw_material_ids, expiry_date: form.expiry_date, supplier_id: form.supplier_id, supplier_name: form.supplier_name });
      } else {
        if (!form.file) { setError('Please select a file.'); setSaving(false); return; }
        const fd = new FormData();
        fd.append('file', form.file);
        fd.append('document_type', form.document_type);
        form.raw_material_ids.forEach(id => fd.append('raw_materials', id));
        fd.append('expiry_date', form.expiry_date);
        fd.append('supplier_id', form.supplier_id);
        fd.append('supplier_name', form.supplier_name);
        await createRawMaterialDoc(fd);
      }
      await load();
      closeForm();
    } catch (e) { setError(e.response?.data?.error || 'Failed to save document.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete document "${name}"?`)) return;
    try { await deleteRawMaterialDoc(id); setDocs(p => p.filter(d => d.id !== id)); }
    catch { alert('Failed to delete document.'); }
  };

  const handleCheckExpiry = async () => {
    setCheckingExpiry(true);
    try {
      const res = await checkDocExpiry();
      alert(`Expiry check complete.\nChecked: ${res.data.checked}\nNotified: ${res.data.notified}`);
      await load();
    } catch { alert('Failed to run expiry check.'); }
    finally { setCheckingExpiry(false); }
  };

  const rmById = (id) => allMaterials.find(m => m.id === id);

  const filtered = docs.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.file_name?.toLowerCase().includes(s) || d.supplier_name?.toLowerCase().includes(s) || d.document_type?.toLowerCase().includes(s) || d.raw_materials?.toLowerCase().includes(s);
  });

  // Available materials for the currently selected supplier (or all if none)
  const availableMaterials = form.supplier_id
    ? (() => {
        const supp = suppliers.find(s => s.id === form.supplier_id);
        if (!supp) return allMaterials;
        const ids = parseRmIds(supp.raw_materials);
        return allMaterials.filter(m => ids.includes(m.id));
      })()
    : allMaterials;

  return (
    <div className="raw-docs-tab">
      <div className="tab-section-header">
        <div>
          <h2 className="tab-section-title">Raw Material Documents</h2>
          <p className="tab-section-subtitle">All compliance documents from suppliers, with expiry tracking and auto-notifications</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={handleCheckExpiry} disabled={checkingExpiry}>
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
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Document' : 'Add Document'}</h3>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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
                <div className="form-field">
                  <label>Supplier</label>
                  <select value={form.supplier_id} onChange={handleSupplierSelect}>
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Supplier Name <span className="hint">(if not in list)</span></label>
                  <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="Or type name" />
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                  Associated Raw Materials
                </label>
                {availableMaterials.length === 0 ? (
                  <p style={{ color: '#999', fontSize: '0.82rem' }}>Select a supplier first to see their raw materials.</p>
                ) : (
                  <div className="rm-select-grid" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {availableMaterials.map(m => (
                      <div key={m.id} className={`rm-select-item ${form.raw_material_ids.includes(m.id) ? 'selected' : ''}`} onClick={() => toggleRmId(m.id)}>
                        <span className="rm-code-badge">{m.id}</span>
                        <span style={{ flex: 1, fontSize: '0.82rem' }}>{m.name}</span>
                        <span className={`rm-type-chip ${m.type === 'Food Grade' ? 'rm-food' : 'rm-industrial'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>{m.type}</span>
                        {form.raw_material_ids.includes(m.id) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    ))}
                  </div>
                )}
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

      <div className="docs-search-bar" style={{ marginBottom: '12px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" placeholder="Search by file name, supplier, document type, or R-code..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px' }} />
      </div>

      <div className="table-card">
        {loading ? (
          <div className="table-loading">
            <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '28px', height: '28px' }} />
            <span>Loading documents...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <p>{search ? 'No documents match your search.' : 'No documents uploaded yet.'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Document Type</th>
                  <th>Raw Materials</th>
                  <th>Expiry Date</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const rmIds = parseRmIds(d.raw_materials);
                  const expired = isExpired(d.expiry_date);
                  const expiringSoon = !expired && isExpiringSoon(d.expiry_date);
                  return (
                    <tr key={d.id} className={expired ? 'row-expired' : expiringSoon ? 'row-expiring' : ''}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{d.file_name}</span>
                        </div>
                      </td>
                      <td>
                        {d.document_type ? <span className="doc-type-badge">{d.document_type}</span> : <span style={{ color: '#aaa' }}>—</span>}
                      </td>
                      <td>
                        <div className="material-chips">
                          {rmIds.length > 0
                            ? rmIds.map(id => {
                                const m = rmById(id);
                                return (
                                  <span key={id} className={`rm-inline-chip ${m?.type === 'Food Grade' ? 'rm-chip-food' : 'rm-chip-industrial'}`}>
                                    <strong>{id}</strong>{m ? ` · ${m.name}` : ''}
                                  </span>
                                );
                              })
                            : <span style={{ color: '#aaa', fontSize: '0.8rem' }}>—</span>}
                        </div>
                      </td>
                      <td>
                        {d.expiry_date ? (
                          <span style={{ fontSize: '0.83rem', fontWeight: expired || expiringSoon ? 600 : 400, color: expired ? '#b91c1c' : expiringSoon ? '#92400e' : 'inherit' }}>
                            {new Date(d.expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            {expired && ' ⚠'}
                          </span>
                        ) : <span style={{ color: '#aaa' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.83rem' }}>{d.supplier_name || '—'}</td>
                      <td>
                        {expired ? <span className="expiry-badge expiry-red">Expired</span>
                          : expiringSoon ? <span className="expiry-badge expiry-yellow">Expiring Soon</span>
                          : d.expiry_date ? <span className="expiry-badge" style={{ background: '#d1fae5', color: '#065f46' }}>Valid</span>
                          : <span style={{ color: '#aaa', fontSize: '0.78rem' }}>No expiry</span>}
                        {d.expiry_notified === 1 && <span style={{ display: 'block', fontSize: '0.7rem', color: '#10b981', marginTop: '2px' }}>✓ Notified</span>}
                      </td>
                      <td>
                        <div className="row-actions">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
