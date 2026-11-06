import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubmission, updateStep4Compliance } from '../api';
import {
  ROHS_SUBSTANCES, ROHS_OPTIONS, SVHC_OPTIONS, REACH_REFERENCES, ROHS_REFERENCES,
  DECLARATIONS, DECLARATION_OPTIONS,
} from '../formConstants';
import { ChoiceButtons, FormErrorBanner, apiErrorMessage } from './FormControls';
import './Step.css';

export function References({ items }) {
  return (
    <div className="reference-links">
      <strong>Official reference{items.length > 1 ? 's' : ''}</strong>
      {items.map(r => (
        <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{r.label} ↗</a>
      ))}
    </div>
  );
}

function ProductBox({ product, children }) {
  return (
    <div className="compliance-product-card">
      <div className="compliance-product-header" style={{ padding: '10px 16px' }}>
        <strong>{product.product_name}</strong>
        <span className={`compliance-product-type-badge ${product.product_type === 'Food Grade' ? '' : 'industrial'}`}>
          {product.product_type}
        </span>
      </div>
      <div style={{ padding: '16px', border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
        {children}
      </div>
    </div>
  );
}

export default function Step4Compliance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [products, setProducts] = useState([]);
  const [rohsData, setRohsData] = useState({});
  const [svhcData, setSvhcData] = useState({});
  const [declarations, setDeclarations] = useState({});
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await getSubmission(id);
        const prods = res.data.products || [];
        setProducts(prods);
        const initRohs = {};
        const initSvhc = {};
        prods.forEach(p => {
          initRohs[p.id] = res.data.rohs_data?.[p.id] || { status: 'Compliant', exemption_ref: '' };
          initSvhc[p.id] = res.data.svhc_data?.[p.id] || { status: 'Do Not Contain', substance_name: '', cas_number: '' };
        });
        setRohsData(initRohs);
        setSvhcData(initSvhc);
        setDeclarations(res.data.declarations || {});
      } catch {
        setSaveError('We could not load your submission. Please refresh the page.');
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [id]);

  const setDeclaration = (key, field, value) => {
    setDeclarations(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    DECLARATIONS.forEach(d => {
      const ans = declarations[d.key]?.answer;
      if (!ans) errs[d.key] = 'Please select an answer';
      else if (ans === 'No' && !declarations[d.key]?.details?.trim()) errs[d.key] = 'Please tell us which products and why';
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setSaveError('Please complete the highlighted fields before continuing.');
      return;
    }

    setSaveError('');
    setLoading(true);
    try {
      await updateStep4Compliance(id, { rohs_data: rohsData, svhc_data: svhcData, declarations });
      navigate(`/form/step5/${id}`);
    } catch (err) {
      setSaveError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="step-container" style={{ textAlign: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ border: '2px solid #ddd', borderTopColor: '#CC0000', width: '32px', height: '32px' }} />
        <p style={{ marginTop: '16px', color: '#666' }}>Loading compliance data...</p>
      </div>
    );
  }

  return (
    <div className="step-container">
      <div className="step-header">
        <div className="step-number">Step 4 of 5</div>
        <h1>EU Compliance Declarations</h1>
        <p>Complete each declaration below. Links to the official regulation texts are provided for reference.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* REACH */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">🧪</span>
            REACH — Substances of Very High Concern (SVHC)
          </h3>
          <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
            Indicate whether each product contains substances on the REACH SVHC Candidate List, and whether they are above 1000 ppm (0.1% w/w).
          </p>
          <References items={REACH_REFERENCES} />

          {products.map(p => (
            <ProductBox key={p.id} product={p}>
              <div className="form-group">
                <label>SVHC status</label>
                <select
                  value={svhcData[p.id]?.status || 'Do Not Contain'}
                  onChange={e => setSvhcData(prev => ({ ...prev, [p.id]: { ...prev[p.id], status: e.target.value } }))}
                >
                  {SVHC_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {svhcData[p.id]?.status === 'Contain SVHCs of more than 1000ppm' && (
                <div className="grid-2">
                  <div className="form-group">
                    <label>SVHC substance name</label>
                    <input
                      type="text"
                      value={svhcData[p.id]?.substance_name || ''}
                      onChange={e => setSvhcData(prev => ({ ...prev, [p.id]: { ...prev[p.id], substance_name: e.target.value } }))}
                      placeholder="Substance name"
                    />
                  </div>
                  <div className="form-group">
                    <label>SVHC CAS #</label>
                    <input
                      type="text"
                      value={svhcData[p.id]?.cas_number || ''}
                      onChange={e => setSvhcData(prev => ({ ...prev, [p.id]: { ...prev[p.id], cas_number: e.target.value } }))}
                      placeholder="CAS number"
                    />
                  </div>
                </div>
              )}
            </ProductBox>
          ))}
        </div>

        {/* RoHS */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">⚡</span>
            1. RoHS
          </h3>
          <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
            EU RoHS Directive 2011/65/EU as amended by (EU) 2015/863. Maximum limits at homogeneous material level:
          </p>
          <References items={ROHS_REFERENCES} />

          <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
            <table className="compliance-ref-table">
              <thead>
                <tr><th>Substance</th><th>Maximum Limit (ppm)</th></tr>
              </thead>
              <tbody>
                {ROHS_SUBSTANCES.map(s => (
                  <tr key={s.name}><td>{s.name}</td><td style={{ textAlign: 'center' }}>{s.limit}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginBottom: '16px', fontStyle: 'italic' }}>
            Note: Maximum limits do not apply to applications for which exemptions have been granted under the RoHS Directive.
          </p>

          {products.map(p => (
            <ProductBox key={p.id} product={p}>
              <div className="form-group">
                <label>RoHS compliance status</label>
                <select
                  value={rohsData[p.id]?.status || 'Compliant'}
                  onChange={e => setRohsData(prev => ({ ...prev, [p.id]: { ...prev[p.id], status: e.target.value } }))}
                >
                  {ROHS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {rohsData[p.id]?.status === 'Compliant with Exemption' && (
                <div className="form-group">
                  <label>Exemption reference number</label>
                  <input
                    type="text"
                    value={rohsData[p.id]?.exemption_ref || ''}
                    onChange={e => setRohsData(prev => ({ ...prev, [p.id]: { ...prev[p.id], exemption_ref: e.target.value } }))}
                    placeholder="Enter exemption reference number"
                  />
                </div>
              )}
            </ProductBox>
          ))}
        </div>

        {/* Other declarations */}
        {DECLARATIONS.map((d, i) => (
          <div key={d.key} className="card" style={{ marginBottom: '20px' }}>
            <h3 className="section-title">
              <span className="section-icon">📋</span>
              {i + 2}. {d.title}
            </h3>
            <div className="declaration-box" style={{ marginBottom: '4px' }}>
              <p>{d.statement}</p>
            </div>
            <References items={d.references} />

            <div className="question-block">
              <label>Do all products in this submission meet this declaration? <span className="required">*</span></label>
              <ChoiceButtons
                value={declarations[d.key]?.answer || ''}
                onChange={v => setDeclaration(d.key, 'answer', v)}
                options={DECLARATION_OPTIONS}
              />
              {declarations[d.key]?.answer === 'No' && (
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Which products do not comply, and why? <span className="required">*</span></label>
                  <textarea
                    rows={3}
                    value={declarations[d.key]?.details || ''}
                    onChange={e => setDeclaration(d.key, 'details', e.target.value)}
                    placeholder="List the product(s) and give details"
                  />
                </div>
              )}
              {errors[d.key] && <span className="error-msg">{errors[d.key]}</span>}
            </div>
          </div>
        ))}

        <FormErrorBanner message={saveError} />

        <div className="step-actions">
          <button type="button" className="btn btn-outline step-back-btn" onClick={() => navigate(`/form/step3/${id}`)}>
            &larr; Back
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Saving...</> : 'Save and Continue →'}
          </button>
        </div>
      </form>
    </div>
  );
}
