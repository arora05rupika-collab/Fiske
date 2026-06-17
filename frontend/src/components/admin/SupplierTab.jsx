import React, { useState, useEffect } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, sendSupplierRequest } from '../../api/index';

const VENDOR_TYPES = ['Preferred Supplier', 'Alternative Supplier'];
const STATUSES = ['Under Review', 'Sent Request', 'Under Process', 'Rejected with Comments', 'Accepted with Comments'];

const STATUS_COLORS = {
  'Under Review': '#f59e0b',
  'Sent Request': '#3b82f6',
  'Under Process': '#8b5cf6',
  'Rejected with Comments': '#ef4444',
  'Accepted with Comments': '#10b981',
};

const emptyForm = { name: '', raw_materials: '', contact_email: '', vendor_type: 'Preferred Supplier', status: 'Under Review', comments: '' };

export default function SupplierTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getSuppliers();
      setSuppliers(res.data);
    } catch (e) {
      setError('Failed to load suppliers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError(''); };
  const openEdit = (s) => {
    const mats = (() => { try { return JSON.parse(s.raw_materials || '[]').join(', '); } catch { return ''; } })();
    setForm({ name: s.name, raw_materials: mats, contact_email: s.contact_email, vendor_type: s.vendor_type, status: s.status, comments: s.comments || '' });
    setEditingId(s.id);
    setShowForm(true);
    setError('');
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required.'); return; }
    if (!form.contact_email.trim()) { setError('Contact email is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const raw_materials = form.raw_materials.split(',').map(s => s.trim()).filter(Boolean);
      const payload = { ...form, raw_materials };
      if (editingId) {
        await updateSupplier(editingId, payload);
        setSuppliers(prev => prev.map(s => s.id === editingId ? { ...s, ...payload, raw_materials: JSON.stringify(raw_materials) } : s));
      } else {
        const res = await createSupplier(payload);
        await load();
        void res;
      }
      closeForm();
    } catch (e) {
      setError('Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete supplier "${name}"?`)) return;
    try {
      await deleteSupplier(id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
    } catch {
      alert('Failed to delete supplier.');
    }
  };

  const handleSendRequest = async (supplier) => {
    if (!window.confirm(`Send compliance request email to ${supplier.contact_email}?`)) return;
    setSendingId(supplier.id);
    try {
      await sendSupplierRequest(supplier.id);
      setSuppliers(prev => prev.map(s => s.id === supplier.id ? { ...s, status: 'Sent Request' } : s));
      alert('Request sent successfully!');
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to send request.');
    } finally {
      setSendingId(null);
    }
  };

  const parseMaterials = (raw) => { try { return JSON.parse(raw || '[]'); } catch { return []; } };

  return (
    <div className="supplier-tab">
      <div className="tab-section-header">
        <div>
          <h2 className="tab-section-title">Suppliers</h2>
          <p className="tab-section-subtitle">Manage supplier registry, vendor types and compliance status</p>
        </div>
        <button className="btn btn-red" onClick={openAdd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Supplier
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="form-error">{error}</div>}
              <div className="form-grid">
                <div className="form-field">
                  <label>Supplier Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Company name" />
                </div>
                <div className="form-field">
                  <label>Contact Email *</label>
                  <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="supplier@example.com" />
                </div>
                <div className="form-field form-field-full">
                  <label>Raw Materials Supplied <span className="hint">(comma-separated)</span></label>
                  <input value={form.raw_materials} onChange={e => setForm(f => ({ ...f, raw_materials: e.target.value }))} placeholder="e.g. Base Oil, Additive A, Grease" />
                </div>
                <div className="form-field">
                  <label>Vendor Type</label>
                  <select value={form.vendor_type} onChange={e => setForm(f => ({ ...f, vendor_type: e.target.value }))}>
                    {VENDOR_TYPES.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-field form-field-full">
                  <label>Comments</label>
                  <textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} placeholder="Additional notes..." rows={3} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="btn btn-red" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div className="table-loading">
            <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '28px', height: '28px' }} />
            <span>Loading suppliers...</span>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="table-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p>No suppliers added yet. Click "Add Supplier" to get started.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Raw Materials</th>
                  <th>Contact Email</th>
                  <th>Vendor Type</th>
                  <th>Status</th>
                  <th>Comments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>
                      <div className="material-chips">
                        {parseMaterials(s.raw_materials).length > 0
                          ? parseMaterials(s.raw_materials).map((m, i) => <span key={i} className="material-chip">{m}</span>)
                          : <span style={{ color: '#aaa', fontSize: '0.8rem' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{s.contact_email || '—'}</td>
                    <td>
                      <span className={`vendor-badge ${s.vendor_type === 'Preferred Supplier' ? 'vendor-preferred' : 'vendor-alternative'}`}>
                        {s.vendor_type}
                      </span>
                    </td>
                    <td>
                      <span className="status-pill" style={{ background: STATUS_COLORS[s.status] + '20', color: STATUS_COLORS[s.status], border: `1px solid ${STATUS_COLORS[s.status]}40` }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#666', maxWidth: '150px' }}>{s.comments || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn action-send"
                          title="Send compliance request"
                          disabled={sendingId === s.id}
                          onClick={() => handleSendRequest(s)}
                        >
                          {sendingId === s.id ? '...' : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                          )}
                        </button>
                        <button className="action-btn action-edit" title="Edit" onClick={() => openEdit(s)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="action-btn action-delete" title="Delete" onClick={() => handleDelete(s.id, s.name)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
