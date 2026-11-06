import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { updateStep3, getSubmission } from '../api';
import { ALLERGENS } from '../formConstants';
import { ChoiceButtons, FormErrorBanner, apiErrorMessage } from './FormControls';
import './Step.css';

export default function Step3() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [products, setProducts] = useState([]);
  const [containsAllergens, setContainsAllergens] = useState('');
  // selected[productId] = Set of allergen codes
  const [selected, setSelected] = useState({});
  const [allergenProducts, setAllergenProducts] = useState([]);
  const [inPlant, setInPlant] = useState('');
  const [crossContamination, setCrossContamination] = useState('');
  const [wheatStarch, setWheatStarch] = useState('');
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await getSubmission(id);
        const d = res.data;
        setProducts(d.products || []);
        const sel = {};
        (d.allergens || []).filter(a => a.in_product === 'Yes').forEach(a => {
          sel[a.product_id] = [...(sel[a.product_id] || []), a.allergen_code];
        });
        setSelected(sel);
        setAllergenProducts(Object.keys(sel));
        setContainsAllergens(d.allergens_in_products || '');
        setInPlant(d.allergens_in_plant || '');
        setCrossContamination(d.cross_contamination_procedures || '');
        setWheatStarch(d.wheat_starch_packaging || '');
      } catch {
        setSaveError('We could not load your submission. Please refresh the page.');
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [id]);

  const toggleAllergen = (productId, code) => {
    setSelected(prev => {
      const cur = prev[productId] || [];
      return { ...prev, [productId]: cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code] };
    });
    setErrors(prev => ({ ...prev, selection: undefined }));
  };

  const clearError = (key) => setErrors(prev => ({ ...prev, [key]: undefined }));

  const toggleProduct = (productId) => {
    setAllergenProducts(prev => (prev.includes(productId) ? prev.filter(x => x !== productId) : [...prev, productId]));
    setErrors(prev => ({ ...prev, products: undefined, selection: undefined }));
  };

  const buildPayload = () => {
    const allergens = [];
    if (containsAllergens === 'Yes') {
      products.filter(p => allergenProducts.includes(p.id)).forEach(p => {
        (selected[p.id] || []).forEach(code => {
          const a = ALLERGENS.find(x => x.code === code);
          if (a) allergens.push({ product_id: p.id, allergen_code: a.code, allergen_label: a.label, in_product: 'Yes' });
        });
      });
    }
    return {
      allergens,
      allergens_in_products: containsAllergens,
      allergens_in_plant: inPlant,
      cross_contamination_procedures: crossContamination,
      wheat_starch_packaging: wheatStarch,
    };
  };

  const goBack = async () => {
    setLoading(true);
    try { await updateStep3(id, buildPayload()); } catch { /* still allow going back */ }
    setLoading(false);
    navigate(`/form/step2/${id}?p=${Math.max(0, products.length - 1)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!containsAllergens) errs.containsAllergens = 'Please select Yes or No';
    if (containsAllergens === 'Yes') {
      if (allergenProducts.length === 0) errs.products = 'Please select the product(s) that contain allergens';
      else if (allergenProducts.some(pid => !(selected[pid] || []).length)) {
        errs.selection = 'Please select at least one allergen for each product you ticked';
      }
    }
    if (!inPlant) errs.inPlant = 'Please select an answer';
    if (!crossContamination) errs.crossContamination = 'Please select an answer';
    if (!wheatStarch) errs.wheatStarch = 'Please select Yes or No';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setSaveError('Please complete the highlighted fields before continuing.');
      return;
    }

    setSaveError('');
    setLoading(true);
    try {
      await updateStep3(id, buildPayload());
      navigate(`/form/step4/${id}`);
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
        <p style={{ marginTop: '16px', color: '#666' }}>Loading allergen data...</p>
      </div>
    );
  }

  return (
    <div className="step-container">
      <div className="step-header">
        <div className="step-number">Step 3 of 5</div>
        <h1>Allergen Declaration</h1>
        <p>Review the allergen list below and tell us whether any of your products contain these allergens.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            Allergen List
          </h3>

          <div className="allergen-table-wrapper" style={{ marginBottom: '24px' }}>
            <table className="allergen-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>#</th>
                  <th className="allergen-name-col">Allergen</th>
                </tr>
              </thead>
              <tbody>
                {ALLERGENS.map((a, i) => (
                  <tr key={a.code}>
                    <td style={{ textAlign: 'center', color: 'var(--gray-500)' }}>{i + 1}</td>
                    <td className="allergen-name">{a.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="question-block">
            <label>Do any of your products contain any of the allergens listed above? <span className="required">*</span></label>
            <ChoiceButtons value={containsAllergens} onChange={v => { setContainsAllergens(v); clearError('containsAllergens'); }} />
            {errors.containsAllergens && <span className="error-msg">{errors.containsAllergens}</span>}
          </div>

          {containsAllergens === 'Yes' && (
            <div className="question-block">
              <label>Which of your products contain allergens? <span className="required">*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {products.map(p => (
                  <label key={p.id} className="checkbox-group" style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={allergenProducts.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                    <span>{p.product_name} <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}>({p.product_type})</span></span>
                  </label>
                ))}
              </div>
              {errors.products && <span className="error-msg">{errors.products}</span>}
            </div>
          )}

          {containsAllergens === 'Yes' && allergenProducts.length > 0 && (
            <div className="question-block">
              <label>Select the allergen(s) in each product <span className="required">*</span></label>
              {products.filter(p => allergenProducts.includes(p.id)).map(p => (
                <div key={p.id} className="product-allergen-row">
                  <h4>
                    {p.product_name}
                    <span className={`compliance-product-type-badge ${p.product_type === 'Food Grade' ? '' : 'industrial'}`}>{p.product_type}</span>
                  </h4>
                  <div className="allergen-chip-grid">
                    {ALLERGENS.map(a => {
                      const isSel = (selected[p.id] || []).includes(a.code);
                      return (
                        <button
                          key={a.code}
                          type="button"
                          className={`allergen-chip ${isSel ? 'selected' : ''}`}
                          onClick={() => toggleAllergen(p.id, a.code)}
                        >
                          {isSel ? '✓ ' : ''}{a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {errors.selection && <span className="error-msg">{errors.selection}</span>}
            </div>
          )}

          <div className="question-block">
            <label>Are any of these allergens present in your plant or production facility? <span className="required">*</span></label>
            <ChoiceButtons value={inPlant} onChange={v => { setInPlant(v); clearError('inPlant'); }} options={['Yes', 'No', 'N/A']} />
            {errors.inPlant && <span className="error-msg">{errors.inPlant}</span>}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            Facility Practices
          </h3>

          <div className="question-block">
            <label>Do you have documented procedures to prevent cross-contamination? <span className="required">*</span></label>
            <div className="toggle-group" style={{ flexWrap: 'wrap' }}>
              {[
                { value: 'Yes - fully documented', label: 'Yes — Fully Documented' },
                { value: 'Partially - under development', label: 'Partial — Under Development' },
                { value: 'No', label: 'No' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`toggle-btn ${crossContamination === opt.value
                    ? opt.value.startsWith('Yes') ? 'active-yes'
                    : opt.value === 'No' ? 'active-no' : 'active-na'
                    : ''}`}
                  onClick={() => { setCrossContamination(opt.value); clearError('crossContamination'); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.crossContamination && <span className="error-msg">{errors.crossContamination}</span>}
          </div>

          <div className="question-block">
            <label>Do any of your packaging materials use wheat-starch release agents? <span className="required">*</span></label>
            <ChoiceButtons value={wheatStarch} onChange={v => { setWheatStarch(v); clearError('wheatStarch'); }} />
            {errors.wheatStarch && <span className="error-msg">{errors.wheatStarch}</span>}
          </div>
        </div>

        <FormErrorBanner message={saveError} />

        <div className="step-actions">
          <button
            type="button"
            className="btn btn-outline step-back-btn"
            onClick={goBack}
            disabled={loading}
          >
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
