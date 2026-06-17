import React, { useState, useEffect, useRef } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, sendSupplierRequest, getRawMaterials, createRawMaterial, deleteRawMaterial } from '../../api/index';

const VENDOR_TYPES = ['Preferred Supplier', 'Alternative Supplier'];
const STATUSES = ['Under Review', 'Sent Request', 'Under Process', 'Rejected with Comments', 'Accepted with Comments'];
const RM_TYPES = ['Industrial', 'Food Grade'];

const STATUS_COLORS = {
  'Under Review': '#f59e0b',
  'Sent Request': '#3b82f6',
  'Under Process': '#8b5cf6',
  'Rejected with Comments': '#ef4444',
  'Accepted with Comments': '#10b981',
};

const emptySupplier = { name: '', contact_email: '', vendor_type: 'Preferred Supplier', status: 'Under Review', comments: '' };

export default function SupplierTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]); // global RawMaterials list
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptySupplier);
  const [selectedRmIds, setSelectedRmIds] = useState([]); // R-codes assigned to this supplier
  const [newMat, setNewMat] = useState({ name: '', type: 'Industrial' });
  const [addingMat, setAddingMat] = useState(false);
  const [rmSearch, setRmSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState('');
  const [showRmManager, setShowRmManager] = useState(false);
  const [editRm, setEditRm] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([getSuppliers(), getRawMaterials()]);
      setSuppliers(sRes.data);
      setAllMaterials(mRes.data);
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(emptySupplier);
    setSelectedRmIds([]);
    setEditingId(null);
    setShowForm(true);
    setError('');
    setNewMat({ name: '', type: 'Industrial' });
  };

  const openEdit = (s) => {
    setForm({ name: s.name, contact_email: s.contact_email, vendor_type: s.vendor_type, status: s.status, comments: s.comments || '' });
    const ids = (() => { try { return JSON.parse(s.raw_materials || '[]'); } catch { return []; } })();
    setSelectedRmIds(ids);
    setEditingId(s.id);
    setShowForm(true);
    setError('');
    setNewMat({ name: '', type: 'Industrial' });
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setError(''); setRmSearch(''); };

  const toggleRm = (id) => {
    setSelectedRmIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddNewMaterial = async () => {
    if (!newMat.name.trim()) return;
    try {
      const res = await createRawMaterial({ name: newMat.name.trim(), type: newMat.type });
      const newId = res.data.id;
      const updated = await getRawMaterials();
      setAllMaterials(updated.data);
      if (!selectedRmIds.includes(newId)) setSelectedRmIds(prev => [...prev, newId]);
      setNewMat({ name: '', type: 'Industrial' });
      setAddingMat(false);
    } catch (e) { alert(e.response?.data?.error || 'Failed to add material.'); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required.'); return; }
    if (!form.contact_email.trim()) { setError('Contact email is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, raw_materials: selectedRmIds };
      if (editingId) {
        await updateSupplier(editingId, payload);
      } else {
        await createSupplier(payload);
      }
      await load();
      closeForm();
    } catch { setError('Failed to save supplier.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete supplier "${name}"?`)) return;
    try { await deleteSupplier(id); setSuppliers(p => p.filter(s => s.id !== id)); }
    catch { alert('Failed to delete supplier.'); }
  };

  const handleSendRequest = async (supplier) => {
    if (!window.confirm(`Send compliance request to ${supplier.contact_email}?`)) return;
    setSendingId(supplier.id);
    try {
      const res = await sendSupplierRequest(supplier.id);
      setSuppliers(p => p.map(s => s.id === supplier.id ? { ...s, status: 'Sent Request' } : s));
      alert(res.data.message || 'Request sent successfully!');
    } catch (e) { alert(e.response?.data?.error || 'Failed to send request.'); }
    finally { setSendingId(null); }
  };

  const handleDeleteRm = async (id) => {
    if (!window.confirm(`Delete raw material ${id}? This will affect all suppliers using it.`)) return;
    try {
      await deleteRawMaterial(id);
      setAllMaterials(p => p.filter(m => m.id !== id));
    } catch { alert('Failed to delete material.'); }
  };

  const rmById = (id) => allMaterials.find(m => m.id === id);
  const parseMaterials = (raw) => { try { return JSON.parse(raw || '[]'); } catch { return []; } };

  const filteredRm = allMaterials.filter(m =>
    !rmSearch || m.name.toLowerCase().includes(rmSearch.toLowerCase()) || m.id.toLowerCase().includes(rmSearch.toLowerCase())
  );

  return (
    <div className="supplier-tab">
      <div className="tab-section-header">
        <div>
          <h2 className="tab-section-title">Suppliers</h2>
          <p className="tab-section-subtitle">Manage supplier registry, vendor types and compliance status</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowRmManager(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            Manage Raw Materials
          </button>
          <button className="btn btn-red" onClick={openAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Supplier
          </button>
        </div>
      </div>

      {/* Raw Materials Manager Modal */}
      {showRmManager && (
        <div className="modal-overlay" onClick={() => setShowRmManager(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Raw Materials Registry</h3>
              <button className="modal-close" onClick={() => setShowRmManager(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  placeholder="Material name"
                  value={newMat.name}
                  onChange={e => setNewMat(p => ({ ...p, name: e.target.value }))}
                  style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', fontSize: '0.875rem' }}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewMaterial()}
                />
                <select value={newMat.type} onChange={e => setNewMat(p => ({ ...p, type: e.target.value }))}
                  style={{ border: '1.5px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', fontSize: '0.875rem' }}>
                  {RM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <button className="btn btn-red" style={{ padding: '7px 14px', fontSize: '0.85rem' }} onClick={handleAddNewMaterial}>Add</button>
              </div>
              <div className="rm-manager-list">
                {allMaterials.length === 0 ? (
                  <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No raw materials yet.</p>
                ) : allMaterials.map(m => (
                  <div key={m.id} className="rm-manager-row">
                    <span className="rm-code-badge">{m.id}</span>
                    <span style={{ flex: 1, fontSize: '0.875rem' }}>{m.name}</span>
                    <span className={`rm-type-chip ${m.type === 'Food Grade' ? 'rm-food' : 'rm-industrial'}`}>{m.type}</span>
                    <button className="action-btn action-delete" onClick={() => handleDeleteRm(m.id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowRmManager(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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
                  <textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} placeholder="Additional notes..." rows={2} />
                </div>
              </div>

              {/* Raw Materials section */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Raw Materials Supplied
                  </label>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem', padding: '4px 10px' }} onClick={() => setAddingMat(p => !p)}>
                    + Add new material
                  </button>
                </div>

                {addingMat && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', background: '#f9fafb', borderRadius: '8px', padding: '10px' }}>
                    <input
                      placeholder="Material name"
                      value={newMat.name}
                      onChange={e => setNewMat(p => ({ ...p, name: e.target.value }))}
                      style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', fontSize: '0.85rem' }}
                      onKeyDown={e => e.key === 'Enter' && handleAddNewMaterial()}
                    />
                    <select value={newMat.type} onChange={e => setNewMat(p => ({ ...p, type: e.target.value }))}
                      style={{ border: '1.5px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', fontSize: '0.85rem' }}>
                      {RM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <button className="btn btn-red" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={handleAddNewMaterial}>Add</button>
                    <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.82rem' }} onClick={() => setAddingMat(false)}>✕</button>
                  </div>
                )}

                <input
                  placeholder="Search existing materials..."
                  value={rmSearch}
                  onChange={e => setRmSearch(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', fontSize: '0.85rem', boxSizing: 'border-box', marginBottom: '8px' }}
                />

                <div className="rm-select-grid">
                  {filteredRm.map(m => (
                    <div
                      key={m.id}
                      className={`rm-select-item ${selectedRmIds.includes(m.id) ? 'selected' : ''}`}
                      onClick={() => toggleRm(m.id)}
                    >
                      <span className="rm-code-badge">{m.id}</span>
                      <span style={{ flex: 1, fontSize: '0.82rem' }}>{m.name}</span>
                      <span className={`rm-type-chip ${m.type === 'Food Grade' ? 'rm-food' : 'rm-industrial'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>{m.type}</span>
                      {selectedRmIds.includes(m.id) && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  ))}
                  {filteredRm.length === 0 && (
                    <p style={{ color: '#aaa', fontSize: '0.8rem', padding: '8px 0' }}>No materials found. Add one above.</p>
                  )}
                </div>

                {selectedRmIds.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {selectedRmIds.map(id => {
                      const m = rmById(id);
                      return m ? (
                        <span key={id} className="material-chip" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <strong>{m.id}</strong> {m.name}
                          <button onClick={() => toggleRm(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: '#0369a1', fontWeight: 'bold', lineHeight: 1 }}>✕</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
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
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <p>No suppliers added yet.</p>
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
                {suppliers.map(s => {
                  const rmIds = parseMaterials(s.raw_materials);
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
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
                      <td style={{ fontSize: '0.8rem', color: '#666', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.comments || '—'}</td>
                      <td>
                        <div className="row-actions">
                          <button className="action-btn action-send" title="Send compliance request" disabled={sendingId === s.id} onClick={() => handleSendRequest(s)}>
                            {sendingId === s.id ? '…' : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
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
