import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAdminSubmission, updateSubmissionStatus, deleteSubmission, archiveSubmission } from '../../api';
import SubmissionFormView from './SubmissionFormView';
import './Admin.css';

const STATUS_COLORS = {
  'In Progress': 'badge-progress',
  'Submitted': 'badge-submitted',
  'Under Review': 'badge-review',
  'Approved': 'badge-approved',
  'Rejected': 'badge-rejected',
  'Archived': 'badge-archived'
};

export default function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await getAdminSubmission(id);
        setSubmission(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete this submission from "${submission?.company_name}"? This cannot be undone.`)) return;
    try {
      await deleteSubmission(id);
      navigate('/admin');
    } catch (err) {
      alert('Failed to delete submission.');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveSubmission(id, true);
      setSubmission(prev => ({ ...prev, status: 'Archived' }));
    } catch (err) {
      alert('Failed to archive submission.');
    }
  };

  const handleRestore = async () => {
    try {
      await archiveSubmission(id, false);
      setSubmission(prev => ({ ...prev, status: prev.submission_date ? 'Submitted' : 'In Progress' }));
    } catch (err) {
      alert('Failed to restore submission.');
    }
  };

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await updateSubmissionStatus(id, newStatus);
      setSubmission(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-detail" style={{ textAlign: 'center', padding: '80px' }}>
        <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '32px', height: '32px', margin: '0 auto' }} />
        <p style={{ marginTop: '16px', color: '#666' }}>Loading submission details...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="admin-detail" style={{ textAlign: 'center', padding: '80px' }}>
        <p>Submission not found.</p>
        <button className="btn btn-outline" onClick={() => navigate('/admin')}>← Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="admin-detail">
      {/* Header */}
      <div className="detail-header">
        <button className="btn btn-ghost btn-sm back-btn" onClick={() => navigate('/admin')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Dashboard
        </button>

        <div className="detail-title-row">
          <div>
            <h1 className="detail-company">{submission.company_name}</h1>
            <div className="detail-meta">
              <span className="ref-number">{submission.reference_number}</span>
              {submission.submission_date && (
                <span>Submitted {new Date(submission.submission_date).toLocaleDateString('en-US', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}</span>
              )}
            </div>
          </div>

          <div className="detail-status-section">
            <span className={`badge ${STATUS_COLORS[submission.status] || ''}`} style={{ fontSize: '0.85rem', padding: '5px 14px' }}>
              {submission.status}
            </span>
            <div className="status-change">
              <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Change Status:</label>
              <select
                value={['Under Review', 'Approved', 'Rejected'].includes(submission.status) ? submission.status : ''}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="status-select"
              >
                <option value="" disabled>Select status…</option>
                <option>Under Review</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>
            </div>
            <div className="detail-actions-row">
              {submission.status === 'Archived' ? (
                <button className="btn btn-outline btn-sm" onClick={handleRestore} title="Restore from archive">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-3" />
                  </svg>
                  Restore
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={handleArchive} title="Archive (Recycle Bin)" style={{ color: '#d97706', borderColor: '#f59e0b' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Archive
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={handleDelete} title="Delete permanently" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <SubmissionFormView submission={submission} />
    </div>
  );
}
