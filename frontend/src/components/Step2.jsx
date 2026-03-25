import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { updateStep2, getSubmission } from '../api';
import './Step.css';

function FileUpload({ label, name, currentFile, onChange }) {
  const [fileName, setFileName] = useState('');

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      onChange(name, file);
    }
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      <label className="file-upload-label">
        <div className={`file-upload-box ${fileName || currentFile ? 'has-file' : ''}`}>
          <input type="file" name={name} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleChange} />
          <div className="file-upload-icon">{fileName || currentFile ? '✓' : '📄'}</div>
          {fileName ? (
            <div className="file-name">{fileName}</div>
          ) : currentFile ? (
            <div className="file-name">File already uploaded</div>
          ) : (
            <div className="file-upload-text">Click to upload PDF, JPG, PNG, DOC<br />(max 20MB)</div>
          )}
        </div>
      </label>
    </div>
  );
}

function ToggleField({ label, value, onChange, options = ['Yes', 'No'] }) {
  return (
    <div className="toggle-row">
      <span className="toggle-row-label">{label}</span>
      <div className="toggle-group">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            className={`toggle-btn ${value === opt ? `active-${opt.toLowerCase().replace(/\s/g, '-')}` : ''}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Step2() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [submission, setSubmission] = useState(null);
  const [products, setProducts] = useState([]);
  const [hasFoodGrade, setHasFoodGrade] = useState(false);

  // Compliance fields
  const [regulatoryCompliant, setRegulatoryCompliant] = useState('');
  const [regulatoryPenalties, setRegulatoryPenalties] = useState('');
  const [penaltyDetails, setPenaltyDetails] = useState('');

  // Kosher
  const [kosherNa, setKosherNa] = useState(false);
  const [kosherExpiry, setKosherExpiry] = useState('');
  const [kosherBody, setKosherBody] = useState('');
  const [kosherFile, setKosherFile] = useState(null);

  // Halal
  const [halalNa, setHalalNa] = useState(false);
  const [halalExpiry, setHalalExpiry] = useState('');
  const [halalBody, setHalalBody] = useState('');
  const [halalFile, setHalalFile] = useState(null);

  // Per-product data
  const [productData, setProductData] = useState({});
  const [productFiles, setProductFiles] = useState({});

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getSubmission(id);
        const sub = res.data;
        setSubmission(sub);
        const prods = sub.products || [];
        setProducts(prods);
        setHasFoodGrade(prods.some(p => p.product_type === 'Food Grade'));

        // Initialize product data
        const pd = {};
        prods.forEach((p, i) => {
          pd[i] = {
            pfas_free: p.pfas_free || '',
            moah_free: p.moah_free || '',
            nsf_cert_expiry: p.nsf_cert_expiry || '',
            nsf_registration_number: p.nsf_registration_number || '',
          };
        });
        setProductData(pd);
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    loadData();
  }, [id]);

  const updateProductField = (index, field, value) => {
    setProductData(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value }
    }));
  };

  const handleFileChange = (name, file) => {
    if (name === 'kosher_cert_file') setKosherFile(file);
    else if (name === 'halal_cert_file') setHalalFile(file);
    else setProductFiles(prev => ({ ...prev, [name]: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!regulatoryCompliant) {
      alert('Please answer the regulatory compliance question.');
      return;
    }
    if (!regulatoryPenalties) {
      alert('Please answer the regulatory penalties question.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('regulatory_compliant', regulatoryCompliant);
      formData.append('regulatory_penalties', regulatoryPenalties);
      formData.append('penalty_details', penaltyDetails);
      formData.append('kosher_cert_na', kosherNa.toString());
      formData.append('kosher_cert_expiry', kosherExpiry);
      formData.append('kosher_cert_body', kosherBody);
      formData.append('halal_cert_na', halalNa.toString());
      formData.append('halal_cert_expiry', halalExpiry);
      formData.append('halal_cert_body', halalBody);

      if (kosherFile) formData.append('kosher_cert_file', kosherFile);
      if (halalFile) formData.append('halal_cert_file', halalFile);

      // Per-product data
      products.forEach((product, index) => {
        const pd = productData[index] || {};
        formData.append(`pfas_free_${index}`, pd.pfas_free || '');
        formData.append(`moah_free_${index}`, pd.moah_free || '');
        formData.append(`nsf_expiry_${index}`, pd.nsf_cert_expiry || '');
        formData.append(`nsf_reg_${index}`, pd.nsf_registration_number || '');

        const sdsFile = productFiles[`sds_file_${index}`];
        const tdsFile = productFiles[`tds_file_${index}`];
        const nsfFile = productFiles[`nsf_cert_file_${index}`];

        if (sdsFile) formData.append(`sds_file_${index}`, sdsFile);
        if (tdsFile) formData.append(`tds_file_${index}`, tdsFile);
        if (nsfFile) formData.append(`nsf_cert_file_${index}`, nsfFile);
      });

      await updateStep2(id, formData);

      // Navigate to step 3 if food grade products, else step 4
      if (hasFoodGrade) {
        navigate(`/form/step3/${id}`);
      } else {
        navigate(`/form/step4/${id}`);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="step-container" style={{ textAlign: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '32px', height: '32px' }} />
        <p style={{ marginTop: '16px', color: '#666' }}>Loading your submission...</p>
      </div>
    );
  }

  return (
    <div className="step-container">
      <div className="step-header">
        <div className="step-number">Step 2 of {hasFoodGrade ? '5' : '5 (Step 3 skipped — no Food Grade products)'}</div>
        <h1>Compliance & Certifications</h1>
        <p>Provide compliance information and upload required certification documents for each product.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Per-product compliance */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">📋</span>
            Product Compliance
          </h3>

          {products.map((product, index) => {
            const pd = productData[index] || {};
            const isFoodGrade = product.product_type === 'Food Grade';

            return (
              <div key={product.id || index} className="compliance-product-card">
                <div className="compliance-product-header">
                  <div style={{ flex: 1 }}>
                    <strong>{product.product_name}</strong>
                  </div>
                  <span className="compliance-product-type-badge">{product.product_type}</span>
                </div>

                <div className="compliance-product-body">
                  <ToggleField
                    label="PFAS Free"
                    value={pd.pfas_free}
                    onChange={v => updateProductField(index, 'pfas_free', v)}
                  />
                  <ToggleField
                    label="MoaH Free (Mineral Oil Aromatic Hydrocarbons)"
                    value={pd.moah_free}
                    onChange={v => updateProductField(index, 'moah_free', v)}
                  />

                  <hr className="section-divider" />

                  <div className="grid-2">
                    <FileUpload
                      label="SDS (Safety Data Sheet)"
                      name={`sds_file_${index}`}
                      currentFile={product.sds_file_path}
                      onChange={handleFileChange}
                    />
                    <FileUpload
                      label="TDS (Technical Data Sheet)"
                      name={`tds_file_${index}`}
                      currentFile={product.tds_file_path}
                      onChange={handleFileChange}
                    />
                  </div>

                  {isFoodGrade && (
                    <>
                      <hr className="section-divider" />
                      <h4 style={{ marginBottom: '12px', color: 'var(--black)', fontSize: '0.9rem' }}>
                        🏅 NSF Certification (Food Grade)
                      </h4>
                      <div className="grid-2">
                        <FileUpload
                          label="NSF Certificate"
                          name={`nsf_cert_file_${index}`}
                          currentFile={product.nsf_cert_file_path}
                          onChange={handleFileChange}
                        />
                        <div>
                          <div className="form-group">
                            <label>NSF Expiry Date</label>
                            <input
                              type="date"
                              value={pd.nsf_cert_expiry}
                              onChange={e => updateProductField(index, 'nsf_cert_expiry', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label>NSF Registration Number</label>
                            <input
                              type="text"
                              value={pd.nsf_registration_number}
                              onChange={e => updateProductField(index, 'nsf_registration_number', e.target.value)}
                              placeholder="e.g. NSF-123456"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Regulatory Compliance */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">⚖️</span>
            Regulatory Compliance
          </h3>

          <div className="form-group">
            <label>Is your company compliant with applicable regulations? <span className="required">*</span></label>
            <div className="toggle-group">
              {['Yes', 'Partial', 'No'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`toggle-btn ${regulatoryCompliant === opt
                    ? opt === 'Yes' ? 'active-yes' : opt === 'No' ? 'active-no' : 'active-na'
                    : ''}`}
                  onClick={() => setRegulatoryCompliant(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Has your company had regulatory penalties in the last 3 years? <span className="required">*</span></label>
            <div className="toggle-group">
              {['Yes', 'No'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`toggle-btn ${regulatoryPenalties === opt
                    ? opt === 'Yes' ? 'active-yes' : 'active-no'
                    : ''}`}
                  onClick={() => setRegulatoryPenalties(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {regulatoryPenalties === 'Yes' && (
            <div className="form-group">
              <label>Please provide details of the penalties</label>
              <textarea
                value={penaltyDetails}
                onChange={e => setPenaltyDetails(e.target.value)}
                placeholder="Describe the regulatory penalties, dates, and resolutions..."
                rows={4}
              />
            </div>
          )}
        </div>

        {/* Food Grade certifications */}
        {hasFoodGrade && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="section-title">
              <span className="section-icon">🥗</span>
              Food Grade Certifications
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '0.875rem' }}>
              These certifications apply to all Food Grade products in your submission.
            </p>

            {/* Kosher */}
            <div className="cert-section" style={{ marginBottom: '16px' }}>
              <h4>✡ Kosher Certification</h4>
              <div className="cert-na-toggle" onClick={() => setKosherNa(!kosherNa)}>
                <input type="checkbox" checked={kosherNa} readOnly />
                <label>Not Applicable — We do not hold Kosher certification</label>
              </div>

              {!kosherNa && (
                <div>
                  <div className="grid-2">
                    <FileUpload
                      label="Kosher Certificate"
                      name="kosher_cert_file"
                      currentFile={submission?.kosher_cert_file_path}
                      onChange={handleFileChange}
                    />
                    <div>
                      <div className="form-group">
                        <label>Expiry Date</label>
                        <input
                          type="date"
                          value={kosherExpiry}
                          onChange={e => setKosherExpiry(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Certifying Body</label>
                        <input
                          type="text"
                          value={kosherBody}
                          onChange={e => setKosherBody(e.target.value)}
                          placeholder="e.g. Orthodox Union"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Halal */}
            <div className="cert-section">
              <h4>☪ Halal Certification</h4>
              <div className="cert-na-toggle" onClick={() => setHalalNa(!halalNa)}>
                <input type="checkbox" checked={halalNa} readOnly />
                <label>Not Applicable — We do not hold Halal certification</label>
              </div>

              {!halalNa && (
                <div>
                  <div className="grid-2">
                    <FileUpload
                      label="Halal Certificate"
                      name="halal_cert_file"
                      currentFile={submission?.halal_cert_file_path}
                      onChange={handleFileChange}
                    />
                    <div>
                      <div className="form-group">
                        <label>Expiry Date</label>
                        <input
                          type="date"
                          value={halalExpiry}
                          onChange={e => setHalalExpiry(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Certifying Body</label>
                        <input
                          type="text"
                          value={halalBody}
                          onChange={e => setHalalBody(e.target.value)}
                          placeholder="e.g. Islamic Food Council"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="step-actions">
          <button type="button" className="btn btn-outline step-back-btn" onClick={() => navigate(`/form/step1`)}>
            ← Back
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Saving...</> : `Continue to ${hasFoodGrade ? 'Allergens' : 'Declaration'} →`}
          </button>
        </div>
      </form>
    </div>
  );
}
