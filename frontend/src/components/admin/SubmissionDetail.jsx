import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAdminSubmission, updateSubmissionStatus, deleteSubmission, archiveSubmission } from '../../api';
import './Admin.css';

const STATUS_COLORS = {
  'Submitted': 'badge-submitted',
  'Under Review': 'badge-review',
  'Approved': 'badge-approved',
  'Rejected': 'badge-rejected',
  'Archived': 'badge-archived'
};

const ALLERGEN_LABELS = {
  peanuts: 'Peanuts',
  tree_nuts: 'Tree Nuts',
  sesame: 'Sesame Seeds',
  milk: 'Milk & Derivatives',
  eggs: 'Egg & Derivatives',
  seafood: 'Seafood',
  soy: 'Soy & Soybean',
  wheat: 'Wheat & Triticale',
  gluten: 'Gluten Sources',
  mustard: 'Mustard',
  sulphites: 'Sulphites (>10ppm)',
  msg: 'MSG',
  art_colours: 'Artificial Colours & Flavours',
  hpp: 'Hydrolyzed Plant Protein (HPP)'
};

function InfoField({ label, value, className }) {
  return (
    <div className={`info-field ${className || ''}`}>
      <div className="info-label">{label}</div>
      <div className="info-value">{value || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Not provided</span>}</div>
    </div>
  );
}

function FileLink({ label, path }) {
  if (!path) return (
    <div className="info-field">
      <div className="info-label">{label}</div>
      <div className="info-value" style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>No file uploaded</div>
    </div>
  );

  return (
    <div className="info-field">
      <div className="info-label">{label}</div>
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className="file-link"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Download File
      </a>
    </div>
  );
}

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
      setSubmission(prev => ({ ...prev, status: 'Submitted' }));
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
      alert('Failed to update status');
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

  const foodGradeProducts = (submission.products || []).filter(p => p.product_type === 'Food Grade');
  const hasAllergens = foodGradeProducts.length > 0;

  const getAllergensForProduct = (productId) => {
    return (submission.allergens || []).filter(a => a.product_id === productId);
  };

  const allergenValue = (val) => {
    if (val === 'Yes') return <span style={{ color: 'var(--red)', fontWeight: '700' }}>Yes</span>;
    if (val === 'No') return <span style={{ color: 'var(--green)', fontWeight: '600' }}>No</span>;
    return <span style={{ color: 'var(--gray-400)' }}>N/A</span>;
  };

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
                value={submission.status}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="status-select"
              >
                <option>Submitted</option>
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

      <div className="detail-grid">
        {/* Left column */}
        <div className="detail-main">
          {/* Company Info */}
          <div className="detail-section">
            <h3 className="detail-section-title">
              <span>🏢</span> Company Information
            </h3>
            <div className="info-grid">
              <InfoField label="Company Legal Name" value={submission.company_name} />
              <InfoField label="Country" value={submission.country} />
              <InfoField label="Primary Contact" value={submission.contact_name} />
              <InfoField label="Contact Email" value={submission.contact_email} />
            </div>
          </div>

          {/* Products */}
          <div className="detail-section">
            <h3 className="detail-section-title">
              <span>📦</span> Products ({submission.products?.length || 0})
            </h3>
            {(submission.products || []).map((product, i) => (
              <div key={product.id} className="product-detail-card">
                <div className="product-detail-header">
                  <strong>{product.product_name}</strong>
                  <span className={`product-type-chip ${product.product_type === 'Food Grade' ? 'chip-food' : 'chip-industrial'}`}>
                    {product.product_type}
                  </span>
                </div>
                <div className="product-detail-body">
                  <div className="info-grid">
                    <InfoField label="PFAS Free" value={product.pfas_free} />
                    <InfoField label="MoaH Free" value={product.moah_free} />
                  </div>
                  <div className="info-grid">
                    <FileLink label="SDS (Safety Data Sheet)" path={product.sds_file_path} />
                    <FileLink label="TDS (Technical Data Sheet)" path={product.tds_file_path} />
                  </div>
                  {product.product_type === 'Food Grade' && (
                    <div className="info-grid">
                      <FileLink label="NSF Certificate" path={product.nsf_cert_file_path} />
                      <InfoField label="NSF Expiry" value={product.nsf_cert_expiry} />
                      <InfoField label="NSF Reg #" value={product.nsf_registration_number} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Regulatory */}
          <div className="detail-section">
            <h3 className="detail-section-title">
              <span>⚖️</span> Regulatory Compliance
            </h3>
            <div className="info-grid">
              <InfoField label="Regulatory Compliance" value={submission.regulatory_compliant} />
              <InfoField label="Regulatory Penalties (3 years)" value={submission.regulatory_penalties} />
            </div>
            {submission.penalty_details && (
              <InfoField label="Penalty Details" value={submission.penalty_details} />
            )}
          </div>

          {/* Certifications */}
          {foodGradeProducts.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">
                <span>🥗</span> Food Grade Certifications
              </h3>
              <div className="cert-detail-grid">
                <div className="cert-detail-card">
                  <h4>✡ Kosher</h4>
                  {submission.kosher_cert_na ? (
                    <span className="cert-na-label">Not Applicable</span>
                  ) : (
                    <div className="info-grid">
                      <InfoField label="Certifying Body" value={submission.kosher_cert_body} />
                      <InfoField label="Expiry Date" value={submission.kosher_cert_expiry} />
                      <FileLink label="Certificate" path={submission.kosher_cert_file_path} />
                    </div>
                  )}
                </div>
                <div className="cert-detail-card">
                  <h4>☪ Halal</h4>
                  {submission.halal_cert_na ? (
                    <span className="cert-na-label">Not Applicable</span>
                  ) : (
                    <div className="info-grid">
                      <InfoField label="Certifying Body" value={submission.halal_cert_body} />
                      <InfoField label="Expiry Date" value={submission.halal_cert_expiry} />
                      <FileLink label="Certificate" path={submission.halal_cert_file_path} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* EU Compliance */}
          {submission.rohs_data && (
            <div className="detail-section">
              <h3 className="detail-section-title">
                <span>🇪🇺</span> EU Compliance Declarations
              </h3>

              {/* RoHS */}
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>EU RoHS Declaration</h4>
              {(submission.products || []).map(product => {
                const rohs = submission.rohs_data?.[product.id];
                if (!rohs) return null;
                return (
                  <div key={`rohs-${product.id}`} style={{ marginBottom: '12px', padding: '10px', background: 'var(--gray-50)', borderRadius: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{product.product_name}</strong>
                    <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      Status: <span style={{ fontWeight: 600, color: rohs.status === 'Compliant' ? 'var(--green)' : rohs.status === 'Not Compliant' ? 'var(--red)' : 'var(--gray-700)' }}>{rohs.status}</span>
                      {rohs.exemption_ref && <span> (Exemption: {rohs.exemption_ref})</span>}
                    </div>
                  </div>
                );
              })}

              {/* SVHC */}
              {submission.svhc_data && (
                <>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', marginTop: '16px' }}>EU SVHC (REACH)</h4>
                  {(submission.products || []).map(product => {
                    const svhc = submission.svhc_data?.[product.id];
                    if (!svhc) return null;
                    return (
                      <div key={`svhc-${product.id}`} style={{ marginBottom: '12px', padding: '10px', background: 'var(--gray-50)', borderRadius: '6px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{product.product_name}</strong>
                        <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                          Status: <span style={{ fontWeight: 600, color: svhc.status === 'Do Not Contain' ? 'var(--green)' : 'var(--red)' }}>{svhc.status}</span>
                          {svhc.substance_name && <div>Substance: {svhc.substance_name} (CAS: {svhc.cas_number})</div>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* PFAS */}
              {submission.pfas_data && (
                <>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', marginTop: '16px' }}>PFAS Declaration</h4>
                  {(submission.products || []).map(product => {
                    const pfas = submission.pfas_data?.[product.id];
                    if (!pfas) return null;
                    return (
                      <div key={`pfas-${product.id}`} style={{ marginBottom: '12px', padding: '10px', background: 'var(--gray-50)', borderRadius: '6px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{product.product_name}</strong>
                        <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                          Contains PFAS: <span style={{ fontWeight: 600, color: pfas.contains_pfas === 'No' ? 'var(--green)' : 'var(--red)' }}>{pfas.contains_pfas}</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* FMD */}
              {submission.fmd_data && (
                <>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', marginTop: '16px' }}>Full Material Declaration (FMD)</h4>
                  {(submission.products || []).map(product => {
                    const fmd = submission.fmd_data?.[product.id];
                    if (!fmd) return null;
                    return (
                      <div key={`fmd-${product.id}`} style={{ marginBottom: '12px', padding: '10px', background: 'var(--gray-50)', borderRadius: '6px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{product.product_name}</strong>
                        <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                          FMD Document: {fmd.fmd_doc || 'N/A'}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Allergens */}
          {hasAllergens && (
            <div className="detail-section">
              <h3 className="detail-section-title">
                <span>🧪</span> Allergen Information
              </h3>
              <div className="info-grid" style={{ marginBottom: '16px' }}>
                <InfoField label="Cross-Contamination Procedures" value={submission.cross_contamination_procedures} />
                <InfoField label="Wheat-Starch Packaging" value={submission.wheat_starch_packaging} />
              </div>

              {foodGradeProducts.map(product => {
                const allergens = getAllergensForProduct(product.id);
                if (allergens.length === 0) return null;
                return (
                  <div key={product.id} style={{ marginBottom: '20px' }}>
                    <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>{product.product_name}</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="allergen-detail-table">
                        <thead>
                          <tr>
                            <th>Allergen</th>
                            <th>In Product</th>
                            <th>Same Production Line</th>
                            <th>Anywhere in Plant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allergens.map(a => (
                            <tr key={a.id}>
                              <td style={{ fontWeight: '500', fontSize: '0.85rem' }}>{a.allergen_label}</td>
                              <td style={{ textAlign: 'center' }}>{allergenValue(a.in_product)}</td>
                              <td style={{ textAlign: 'center' }}>{allergenValue(a.same_line)}</td>
                              <td style={{ textAlign: 'center' }}>{allergenValue(a.same_plant)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="detail-sidebar">
          {/* Declaration */}
          <div className="detail-section">
            <h3 className="detail-section-title">
              <span>📜</span> Declaration
            </h3>
            <InfoField label="Signatory Name" value={submission.signatory_name} />
            <InfoField label="Job Title" value={submission.signatory_title} />
            <InfoField
              label="Submission Date"
              value={submission.submission_date
                ? new Date(submission.submission_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : null
              }
            />

            {submission.signature_image_path && (
              <div className="info-field">
                <div className="info-label">Signature</div>
                <div className="signature-display">
                  <img
                    src={submission.signature_image_path}
                    alt="Supplier signature"
                    className="signature-img"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
