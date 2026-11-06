import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { updateProduct, getSubmission } from '../api';
import { FileUpload, ChoiceButtons, FormErrorBanner, apiErrorMessage } from './FormControls';
import './Step.css';

const MULTI_PRODUCT_CAPTION =
  'If you have one statement or certificate that covers multiple products, please attach it again for each product.';

function answersFromProduct(p) {
  return {
    pfas_free: p.pfas_free || '',
    moah_free: p.moah_free || '',
    nsf_cert_expiry: p.nsf_cert_expiry || '',
    nsf_registration_number: p.nsf_registration_number || '',
    halal_certified: p.halal_certified || '',
    halal_cert_expiry: p.halal_cert_expiry || '',
    kosher_certified: p.kosher_certified || '',
    kosher_cert_expiry: p.kosher_cert_expiry || '',
  };
}

export default function Step2() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const index = Math.max(0, parseInt(searchParams.get('p') || '0', 10) || 0);

  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [answers, setAnswers] = useState({});
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getSubmission(id)
      .then(res => setProducts(res.data.products || []))
      .catch(() => setSaveError('We could not load your submission. Please refresh the page.'))
      .finally(() => setFetching(false));
  }, [id]);

  const product = products[index];

  useEffect(() => {
    if (!product) return;
    setAnswers(answersFromProduct(product));
    setFiles({});
    setErrors({});
    setSaveError('');
    window.scrollTo(0, 0);
  }, [product?.id]);

  const setAnswer = (field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const setFile = (name, file) => {
    setFiles(prev => ({ ...prev, [name]: file }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const isFoodGrade = product?.product_type === 'Food Grade';

  const validate = () => {
    const errs = {};
    if (!answers.pfas_free) errs.pfas_free = 'Please select Yes or No';
    if (!answers.moah_free) errs.moah_free = 'Please select Yes or No';
    if (isFoodGrade) {
      if (!answers.halal_certified) errs.halal_certified = 'Please select an answer';
      else if (answers.halal_certified === 'Yes' && !files.halal_cert_file && !product.halal_cert_file_path) {
        errs.halal_cert_file = 'Please attach the Halal certificate';
      }
      if (!answers.kosher_certified) errs.kosher_certified = 'Please select an answer';
      else if (answers.kosher_certified === 'Yes' && !files.kosher_cert_file && !product.kosher_cert_file_path) {
        errs.kosher_cert_file = 'Please attach the Kosher certificate';
      }
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setSaveError('Please complete the highlighted fields before continuing.');
      return;
    }

    setSaveError('');
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(answers).forEach(([k, v]) => formData.append(k, v || ''));
      Object.entries(files).forEach(([k, f]) => { if (f) formData.append(k, f); });

      const res = await updateProduct(id, product.id, formData);
      setProducts(prev => prev.map(p => (p.id === product.id ? res.data.product : p)));

      if (index < products.length - 1) {
        navigate(`/form/step2/${id}?p=${index + 1}`);
      } else {
        navigate(`/form/step3/${id}`);
      }
    } catch (err) {
      setSaveError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (index > 0) navigate(`/form/step2/${id}?p=${index - 1}`);
    else navigate('/form/step1');
  };

  if (fetching) {
    return (
      <div className="step-container" style={{ textAlign: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '32px', height: '32px' }} />
        <p style={{ marginTop: '16px', color: '#666' }}>Loading your submission...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="step-container">
        <FormErrorBanner message={saveError || 'This product could not be found.'} />
      </div>
    );
  }

  return (
    <div className="step-container">
      <div className="step-header">
        <div className="step-number">Step 2 of 5 — Product {index + 1} of {products.length}</div>
        <h1>{product.product_name}</h1>
        <p>Upload the documents and answer the questions below for this product.</p>
      </div>

      <form key={product.id} onSubmit={handleSubmit} noValidate>
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="section-header-row">
            <h3 className="section-title">
              <span className="section-icon">📄</span>
              Product Documents
            </h3>
            <span className={`compliance-product-type-badge ${isFoodGrade ? '' : 'industrial'}`}>{product.product_type}</span>
          </div>

          <div className="grid-2">
            <FileUpload label="SDS (Safety Data Sheet)" name="sds_file" currentFile={product.sds_file_path} onChange={setFile} />
            <FileUpload label="TDS (Technical Data Sheet)" name="tds_file" currentFile={product.tds_file_path} onChange={setFile} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">🔬</span>
            PFAS & MOAH
          </h3>
          <p className="field-caption" style={{ marginTop: 0 }}>{MULTI_PRODUCT_CAPTION}</p>

          <div className="question-block">
            <label>Is this product PFAS free? <span className="required">*</span></label>
            <ChoiceButtons value={answers.pfas_free} onChange={v => setAnswer('pfas_free', v)} />
            {errors.pfas_free && <span className="error-msg">{errors.pfas_free}</span>}
            <div style={{ marginTop: '12px' }}>
              <FileUpload label="PFAS statement (optional)" name="pfas_file" currentFile={product.pfas_file_path} onChange={setFile} />
            </div>
          </div>

          <div className="question-block">
            <label>Is this product MOAH free (Mineral Oil Aromatic Hydrocarbons)? <span className="required">*</span></label>
            <ChoiceButtons value={answers.moah_free} onChange={v => setAnswer('moah_free', v)} />
            {errors.moah_free && <span className="error-msg">{errors.moah_free}</span>}
            <div style={{ marginTop: '12px' }}>
              <FileUpload label="MOAH statement (optional)" name="moah_file" currentFile={product.moah_file_path} onChange={setFile} />
            </div>
          </div>
        </div>

        {isFoodGrade && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="section-title">
              <span className="section-icon">🏅</span>
              Food Grade Certifications
            </h3>
            <p className="field-caption" style={{ marginTop: 0 }}>{MULTI_PRODUCT_CAPTION}</p>

            <div className="question-block">
              <label>Is this product Halal certified? <span className="required">*</span></label>
              <ChoiceButtons value={answers.halal_certified} onChange={v => setAnswer('halal_certified', v)} options={['Yes', 'No', 'N/A']} />
              {errors.halal_certified && <span className="error-msg">{errors.halal_certified}</span>}
              {answers.halal_certified === 'Yes' && (
                <div className="grid-2" style={{ marginTop: '12px' }}>
                  <div>
                    <FileUpload label="Halal certificate" name="halal_cert_file" required currentFile={product.halal_cert_file_path} onChange={setFile} hasError={!!errors.halal_cert_file} />
                    {errors.halal_cert_file && <span className="error-msg">{errors.halal_cert_file}</span>}
                  </div>
                  <div className="form-group">
                    <label>Expiry date</label>
                    <input type="date" value={answers.halal_cert_expiry} onChange={e => setAnswer('halal_cert_expiry', e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="question-block">
              <label>Is this product Kosher certified? <span className="required">*</span></label>
              <ChoiceButtons value={answers.kosher_certified} onChange={v => setAnswer('kosher_certified', v)} options={['Yes', 'No', 'N/A']} />
              {errors.kosher_certified && <span className="error-msg">{errors.kosher_certified}</span>}
              {answers.kosher_certified === 'Yes' && (
                <div className="grid-2" style={{ marginTop: '12px' }}>
                  <div>
                    <FileUpload label="Kosher certificate" name="kosher_cert_file" required currentFile={product.kosher_cert_file_path} onChange={setFile} hasError={!!errors.kosher_cert_file} />
                    {errors.kosher_cert_file && <span className="error-msg">{errors.kosher_cert_file}</span>}
                  </div>
                  <div className="form-group">
                    <label>Expiry date</label>
                    <input type="date" value={answers.kosher_cert_expiry} onChange={e => setAnswer('kosher_cert_expiry', e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="question-block">
              <label>NSF Certification</label>
              <div className="grid-2">
                <FileUpload label="NSF certificate" name="nsf_cert_file" currentFile={product.nsf_cert_file_path} onChange={setFile} />
                <div>
                  <div className="form-group">
                    <label>NSF expiry date</label>
                    <input type="date" value={answers.nsf_cert_expiry} onChange={e => setAnswer('nsf_cert_expiry', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>NSF registration number</label>
                    <input type="text" value={answers.nsf_registration_number} onChange={e => setAnswer('nsf_registration_number', e.target.value)} placeholder="e.g. NSF-123456" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <FormErrorBanner message={saveError} />

        <div className="step-actions">
          <button type="button" className="btn btn-outline step-back-btn" onClick={goBack}>
            ← Back
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Saving...</> : 'Save and Continue →'}
          </button>
        </div>
      </form>
    </div>
  );
}
