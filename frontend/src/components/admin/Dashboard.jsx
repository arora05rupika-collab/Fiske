import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminSubmissions, exportSubmissions, deleteSubmission, archiveSubmission } from '../../api';
import SupplierTab from './SupplierTab';
import RawMaterialDocsTab from './RawMaterialDocsTab';
import './Admin.css';

const STATUS_COLORS = {
  'Submitted': 'badge-submitted',
  'Under Review': 'badge-review',
  'Approved': 'badge-approved',
  'Rejected': 'badge-rejected',
  'Archived': 'badge-archived'
};

function StatCard({ label, value, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('suppliers');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    status: '',
    search: '',
    product_type: '',
    date_from: '',
    date_to: ''
  });

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await getAdminSubmissions(params);
      setSubmissions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(loadSubmissions, 300);
    return () => clearTimeout(timer);
  }, [loadSubmissions]);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = { format };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await exportSubmissions(params);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `submissions.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: '', search: '', product_type: '', date_from: '', date_to: '' });
  };

  // Stats
  const stats = {
    total: submissions.length,
    submitted: submissions.filter(s => s.status === 'Submitted').length,
    review: submissions.filter(s => s.status === 'Under Review').length,
    approved: submissions.filter(s => s.status === 'Approved').length,
    rejected: submissions.filter(s => s.status === 'Rejected').length,
  };

  const handleDelete = async (e, id, companyName) => {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete submission from "${companyName}"? This cannot be undone.`)) return;
    try {
      await deleteSubmission(id);
      setSubmissions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert('Failed to delete submission.');
    }
  };

  const handleArchive = async (e, id) => {
    e.stopPropagation();
    try {
      await archiveSubmission(id, true);
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'Archived' } : s));
    } catch (err) {
      alert('Failed to archive submission.');
    }
  };

  const handleRestore = async (e, id) => {
    e.stopPropagation();
    try {
      await archiveSubmission(id, false);
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'Submitted' } : s));
    } catch (err) {
      alert('Failed to restore submission.');
    }
  };

  const hasFilters = Object.values(filters).some(v => v);

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Admin Portal</h1>
          <p className="dashboard-subtitle">Manage suppliers, compliance documents and submissions</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => setActiveTab('suppliers')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Supplier
        </button>
        <button className={`admin-tab ${activeTab === 'raw-material-docs' ? 'active' : ''}`} onClick={() => setActiveTab('raw-material-docs')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Raw Material Docs
        </button>
        <button className={`admin-tab ${activeTab === 'submissions' ? 'active' : ''}`} onClick={() => setActiveTab('submissions')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Submissions
        </button>
      </div>

      {activeTab === 'suppliers' && <SupplierTab />}
      {activeTab === 'raw-material-docs' && <RawMaterialDocsTab />}

      {activeTab === 'submissions' && <>

      {/* Stats */}
      <div className="stats-row">
        <StatCard label="Total Submissions" value={stats.total} color="gray" />
        <StatCard label="Submitted" value={stats.submitted} color="blue" />
        <StatCard label="Under Review" value={stats.review} color="yellow" />
        <StatCard label="Approved" value={stats.approved} color="green" />
        <StatCard label="Rejected" value={stats.rejected} color="red" />
      </div>

      {/* Filters */}
      <div className="filters-card">
        <div className="filters-row">
          <div className="filter-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search company, email, or reference..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
            />
          </div>

          <select value={filters.status} onChange={e => updateFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            <option>Submitted</option>
            <option>Under Review</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>

          <select value={filters.product_type} onChange={e => updateFilter('product_type', e.target.value)}>
            <option value="">All Product Types</option>
            <option value="Food Grade">Food Grade</option>
            <option value="Industrial">Industrial</option>
          </select>

          <input
            type="date"
            value={filters.date_from}
            onChange={e => updateFilter('date_from', e.target.value)}
            placeholder="From date"
            title="From date"
          />

          <input
            type="date"
            value={filters.date_to}
            onChange={e => updateFilter('date_to', e.target.value)}
            placeholder="To date"
            title="To date"
          />

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear ✕
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading">
            <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '28px', height: '28px' }} />
            <span>Loading submissions...</span>
          </div>
        ) : submissions.length === 0 ? (
          <div className="table-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p>{hasFilters ? 'No submissions match your filters.' : 'No submissions yet.'}</p>
            {hasFilters && <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear Filters</button>}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table submissions-table">
              <thead>
                <tr>
                  <th>Reference #</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Products</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr
                    key={s.id}
                    className="submission-row"
                    onClick={() => navigate(`/admin/submissions/${s.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="ref-number">{s.reference_number || '—'}</span>
                    </td>
                    <td>
                      <div className="company-name">{s.company_name || '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{s.contact_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{s.contact_email}</div>
                    </td>
                    <td>
                      <div className="product-info">
                        <span className="product-count">{s.product_count || 0}</span>
                        {s.product_types && s.product_types.split(',').map((t, i) => (
                          <span key={i} className={`product-type-chip ${t.trim() === 'Food Grade' ? 'chip-food' : 'chip-industrial'}`}>
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                        {s.submission_date
                          ? new Date(s.submission_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>In progress</span>}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[s.status] || 'badge-submitted'}`}>
                        {s.status || 'Submitted'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions" onClick={e => e.stopPropagation()}>
                        {s.status === 'Archived' ? (
                          <button
                            className="action-btn action-restore"
                            title="Restore"
                            onClick={e => handleRestore(e, s.id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="1 4 1 10 7 10" />
                              <path d="M3.51 15a9 9 0 1 0 .49-3" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            className="action-btn action-archive"
                            title="Archive (Recycle)"
                            onClick={e => handleArchive(e, s.id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="action-btn action-delete"
                          title="Delete permanently"
                          onClick={e => handleDelete(e, s.id, s.company_name)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
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

      </>}
    </div>
  );
}
