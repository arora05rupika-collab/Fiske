import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SignaturePad from 'signature_pad';
import { updateStep4, getSubmission } from '../api';
import './Step.css';

export default function Step4() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const sigPadRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [submission, setSubmission] = useState(null);
  const [sigEmpty, setSigEmpty] = useState(true);

  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [authorised, setAuthorised] = useState(false);
  const [errors, setErrors] = useState({});

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await getSubmission(id);
        setSubmission(res.data);
        if (res.data.signatory_name) setSignatoryName(res.data.signatory_name);
        if (res.data.signatory_title) setSignatoryTitle(res.data.signatory_title);
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [id]);

  // Initialize signature pad
  useEffect(() => {
    if (!canvasRef.current || fetching) return;

    const canvas = canvasRef.current;
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      if (sigPadRef.current) sigPadRef.current.clear();
    };

    sigPadRef.current = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: '#1A1A1A',
      minWidth: 1.5,
      maxWidth: 3,
    });

    sigPadRef.current.addEventListener('endStroke', () => {
      setSigEmpty(sigPadRef.current.isEmpty());
    });

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [fetching]);

  const clearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      setSigEmpty(true);
    }
  };

  const validate = () => {
    const errs = {};
    if (!signatoryName.trim()) errs.signatoryName = 'Required';
    if (!signatoryTitle.trim()) errs.signatoryTitle = 'Required';
    if (sigEmpty) errs.signature = 'Please draw your signature';
    if (!authorised) errs.authorised = 'You must confirm authorisation';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('signatory_name', signatoryName);
      formData.append('signatory_title', signatoryTitle);

      // Get signature as base64 data URL
      const signatureData = sigPadRef.current.toDataURL('image/png');
      formData.append('signature_data', signatureData);

      const res = await updateStep4(id, formData);
      navigate(`/confirmation/${id}`, {
        state: {
          reference_number: res.data.reference_number,
          company_name: res.data.company_name,
          contact_email: res.data.contact_email
        }
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="step-container" style={{ textAlign: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '32px', height: '32px' }} />
        <p style={{ marginTop: '16px', color: '#666' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="step-container">
      <div className="step-header">
        <div className="step-number">Step 5 of 5</div>
        <h1>Declaration & Signature</h1>
        <p>Please read the declaration carefully, then sign and submit your compliance information.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Declaration */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">📜</span>
            Legal Declaration
          </h3>

          <div className="declaration-box">
            <p>
              I, the undersigned, on behalf of the supplier named in this submission, hereby declare that all
              information, certifications, and allergen disclosures provided are accurate, complete, and truthful
              to the best of my knowledge. All uploaded documents are valid and have not expired at the date of
              submission. I confirm I am authorised to sign this declaration on behalf of my organisation.
            </p>
          </div>

          <div className="grid-2" style={{ marginBottom: '16px' }}>
            <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '4px' }}>COMPANY</div>
              <div style={{ fontWeight: '600', color: 'var(--black)' }}>{submission?.company_name || '—'}</div>
            </div>
            <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '4px' }}>DATE</div>
              <div style={{ fontWeight: '600', color: 'var(--black)' }}>{today}</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Signatory Full Name <span className="required">*</span></label>
              <input
                type="text"
                value={signatoryName}
                onChange={e => { setSignatoryName(e.target.value); setErrors({...errors, signatoryName: undefined}); }}
                placeholder="Full legal name"
                className={errors.signatoryName ? 'error' : ''}
              />
              {errors.signatoryName && <span className="error-msg">{errors.signatoryName}</span>}
            </div>

            <div className="form-group">
              <label>Job Title <span className="required">*</span></label>
              <input
                type="text"
                value={signatoryTitle}
                onChange={e => { setSignatoryTitle(e.target.value); setErrors({...errors, signatoryTitle: undefined}); }}
                placeholder="e.g. Quality Manager"
                className={errors.signatoryTitle ? 'error' : ''}
              />
              {errors.signatoryTitle && <span className="error-msg">{errors.signatoryTitle}</span>}
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">✍️</span>
            Signature <span className="required">*</span>
          </h3>
          <p style={{ marginBottom: '12px', fontSize: '0.875rem' }}>
            Please sign below using your mouse, trackpad, or finger (on touch devices).
          </p>

          <div className={`signature-area ${errors.signature ? 'sig-error' : ''}`}>
            {sigEmpty && (
              <div className="signature-placeholder">
                Sign here...
              </div>
            )}
            <canvas ref={canvasRef} className="signature-canvas" />
            <div className="signature-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearSignature}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-3" />
                </svg>
                Clear Signature
              </button>
            </div>
          </div>
          {errors.signature && <span className="error-msg" style={{ marginTop: '4px', display: 'block' }}>{errors.signature}</span>}
        </div>

        {/* Authorisation */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <label className={`checkbox-group ${errors.authorised ? 'has-error' : ''}`} style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={authorised}
              onChange={e => { setAuthorised(e.target.checked); setErrors({...errors, authorised: undefined}); }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--gray-700)' }}>
              I confirm I am authorised to submit this form on behalf of my company and that all
              information provided is accurate and complete. <span className="required">*</span>
            </span>
          </label>
          {errors.authorised && <span className="error-msg" style={{ marginTop: '8px', display: 'block' }}>{errors.authorised}</span>}
        </div>

        <div className="step-actions">
          <button type="button" className="btn btn-outline step-back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <button type="submit" className="btn btn-success btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Submitting...</> : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Submit Compliance Form
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
