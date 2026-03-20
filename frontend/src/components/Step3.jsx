import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { updateStep3, getSubmission } from '../api';
import './Step.css';

const ALLERGENS = [
  { code: 'peanuts', label: 'Peanuts' },
  { code: 'tree_nuts', label: 'Tree Nuts (almond / cashew / walnut)' },
  { code: 'sesame', label: 'Sesame Seeds' },
  { code: 'milk', label: 'Milk & Derivatives' },
  { code: 'eggs', label: 'Egg & Derivatives' },
  { code: 'seafood', label: 'Seafood (fish / crustaceans / shellfish)' },
  { code: 'soy', label: 'Soy & Soybean' },
  { code: 'wheat', label: 'Wheat & Triticale' },
  { code: 'gluten', label: 'Gluten Sources (barley / oats / rye)' },
  { code: 'mustard', label: 'Mustard' },
  { code: 'sulphites', label: 'Sulphites (>10ppm)' },
  { code: 'msg', label: 'Monosodium Glutamate (MSG)' },
  { code: 'art_colours', label: 'Artificial Colours & Flavours' },
  { code: 'hpp', label: 'Hydrolyzed Plant Protein (HPP)' },
];

const OPTIONS = ['Yes', 'No', 'N/A'];

function AllergenRadio({ value, onChange }) {
  return (
    <div className="allergen-radio-group">
      {OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          className={`allergen-radio-btn ${value === opt ? `sel-${opt.toLowerCase().replace('/', '')}` : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ProductAllergenTable({ product, allergenData, onUpdate }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div className="compliance-product-header" style={{
        background: 'var(--black)', color: 'white', padding: '12px 16px',
        borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <strong>{product.product_name}</strong>
        <span className="compliance-product-type-badge">Food Grade</span>
      </div>

      <div className="allergen-table-wrapper" style={{ borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
        <table className="allergen-table">
          <thead>
            <tr>
              <th className="allergen-name-col">Allergen</th>
              <th>In Product</th>
              <th>Same Production Line</th>
              <th>Anywhere in Plant</th>
            </tr>
          </thead>
          <tbody>
            {ALLERGENS.map(allergen => {
              const row = allergenData[allergen.code] || { in_product: 'N/A', same_line: 'N/A', same_plant: 'N/A' };
              return (
                <tr key={allergen.code}>
                  <td className="allergen-name">{allergen.label}</td>
                  <td>
                    <AllergenRadio
                      value={row.in_product}
                      onChange={v => onUpdate(allergen.code, 'in_product', v)}
                    />
                  </td>
                  <td>
                    <AllergenRadio
                      value={row.same_line}
                      onChange={v => onUpdate(allergen.code, 'same_line', v)}
                    />
                  </td>
                  <td>
                    <AllergenRadio
                      value={row.same_plant}
                      onChange={v => onUpdate(allergen.code, 'same_plant', v)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Step3() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [foodGradeProducts, setFoodGradeProducts] = useState([]);
  // allergenState[productId][allergenCode] = { in_product, same_line, same_plant }
  const [allergenState, setAllergenState] = useState({});
  const [crossContamination, setCrossContamination] = useState('');
  const [wheatStarch, setWheatStarch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await getSubmission(id);
        const prods = (res.data.products || []).filter(p => p.product_type === 'Food Grade');

        if (prods.length === 0) {
          // No food grade, skip to step 4
          navigate(`/form/step4/${id}`, { replace: true });
          return;
        }

        setFoodGradeProducts(prods);

        // Initialize allergen state
        const initialState = {};
        prods.forEach(product => {
          initialState[product.id] = {};
          ALLERGENS.forEach(a => {
            initialState[product.id][a.code] = { in_product: 'N/A', same_line: 'N/A', same_plant: 'N/A' };
          });
        });

        // Populate from existing data if any
        const existingAllergens = res.data.allergens || [];
        existingAllergens.forEach(ea => {
          if (initialState[ea.product_id]) {
            initialState[ea.product_id][ea.allergen_code] = {
              in_product: ea.in_product,
              same_line: ea.same_line,
              same_plant: ea.same_plant
            };
          }
        });

        setAllergenState(initialState);

        if (res.data.cross_contamination_procedures) {
          setCrossContamination(res.data.cross_contamination_procedures);
        }
        if (res.data.wheat_starch_packaging) {
          setWheatStarch(res.data.wheat_starch_packaging);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [id]);

  const updateAllergen = (productId, allergenCode, field, value) => {
    setAllergenState(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [allergenCode]: {
          ...prev[productId]?.[allergenCode],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!crossContamination) {
      alert('Please answer the cross-contamination procedures question.');
      return;
    }
    if (!wheatStarch) {
      alert('Please answer the wheat-starch packaging question.');
      return;
    }

    setLoading(true);
    try {
      // Build allergens array
      const allergens = [];
      foodGradeProducts.forEach(product => {
        ALLERGENS.forEach(a => {
          const row = allergenState[product.id]?.[a.code] || {};
          allergens.push({
            product_id: product.id,
            allergen_code: a.code,
            allergen_label: a.label,
            in_product: row.in_product || 'N/A',
            same_line: row.same_line || 'N/A',
            same_plant: row.same_plant || 'N/A'
          });
        });
      });

      await updateStep3(id, {
        allergens,
        cross_contamination_procedures: crossContamination,
        wheat_starch_packaging: wheatStarch
      });

      navigate(`/form/step4/${id}`);
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
        <p style={{ marginTop: '16px', color: '#666' }}>Loading allergen data...</p>
      </div>
    );
  }

  return (
    <div className="step-container">
      <div className="step-header">
        <div className="step-number">Step 3 of 4</div>
        <h1>Allergen Declaration</h1>
        <p>
          Complete the allergen table for each Food Grade product. Indicate whether each allergen is
          present in the product, on the same production line, or anywhere in your facility.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">🧪</span>
            Allergen Information by Product
          </h3>

          <div className="info-box" style={{ marginBottom: '20px' }}>
            <strong>Instructions:</strong> For each allergen, select the appropriate response for each column.
            "Yes" indicates presence, "No" indicates absence, "N/A" means not applicable to your facility.
          </div>

          {foodGradeProducts.map(product => (
            <ProductAllergenTable
              key={product.id}
              product={product}
              allergenData={allergenState[product.id] || {}}
              onUpdate={(allergenCode, field, value) => updateAllergen(product.id, allergenCode, field, value)}
            />
          ))}
        </div>

        {/* Facility questions */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">🏭</span>
            Facility Practices
          </h3>

          <div className="form-group">
            <label>
              Do you have documented procedures to prevent cross-contamination? <span className="required">*</span>
            </label>
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
                  onClick={() => setCrossContamination(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>
              Do any of your packaging materials use wheat-starch release agents? <span className="required">*</span>
            </label>
            <div className="toggle-group">
              {['Yes', 'No'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`toggle-btn ${wheatStarch === opt
                    ? opt === 'Yes' ? 'active-yes' : 'active-no'
                    : ''}`}
                  onClick={() => setWheatStarch(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="step-actions">
          <button type="button" className="btn btn-outline step-back-btn" onClick={() => navigate(`/form/step2/${id}`)}>
            ← Back
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Saving...</> : 'Continue to Declaration →'}
          </button>
        </div>
      </form>
    </div>
  );
}
