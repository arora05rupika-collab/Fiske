import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createSubmission } from '../api';
import axios from 'axios';
import './Step.css';

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Italy',
  'Spain', 'Netherlands', 'Belgium', 'Switzerland', 'Australia', 'Japan',
  'South Korea', 'China', 'India', 'Brazil', 'Mexico', 'Singapore', 'Other'
];

function ProductRow({ product, index, onChange, onRemove, canRemove }) {
  return (
    <div className="product-row">
      <div className="product-row-number">{index + 1}</div>
      <div className="product-row-fields">
        <div className="form-group mb-0">
          <input
            type="text"
            placeholder="Product name"
            value={product.product_name}
            onChange={e => onChange(index, 'product_name', e.target.value)}
            required
          />
        </div>
        <div className="form-group mb-0">
          <select
            value={product.product_type}
            onChange={e => onChange(index, 'product_type', e.target.value)}
            required
          >
            <option value="">Select type...</option>
            <option value="Food Grade">Food Grade</option>
            <option value="Industrial">Industrial</option>
          </select>
        </div>
      </div>
      {canRemove && (
        <button
          type="button"
          className="btn btn-ghost btn-icon remove-btn"
          onClick={() => onRemove(index)}
          title="Remove product"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function Step1() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [prefilled, setPrefilled] = useState(false);

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    country: '',
  });

  const [products, setProducts] = useState([
    { product_name: '', product_type: '' }
  ]);

  useEffect(() => {
    const sid = searchParams.get('sid');
    if (!sid) return;
    axios.get(`/api/admin/suppliers/prefill/${sid}`)
      .then(res => {
        const d = res.data;
        setForm(f => ({
          ...f,
          company_name: d.company_name || '',
          contact_email: d.contact_email || '',
        }));
        if (d.products && d.products.length > 0) {
          setProducts(d.products.map(p => ({ product_name: p.product_name, product_type: p.product_type })));
        }
        setPrefilled(true);
      })
      .catch(() => {});
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!form.company_name.trim()) newErrors.company_name = 'Required';
    if (!form.contact_name.trim()) newErrors.contact_name = 'Required';
    if (!form.contact_email.trim()) newErrors.contact_email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      newErrors.contact_email = 'Invalid email address';
    }

    products.forEach((p, i) => {
      if (!p.product_name.trim()) newErrors[`product_name_${i}`] = 'Required';
      if (!p.product_type) newErrors[`product_type_${i}`] = 'Required';
    });

    return newErrors;
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
      const res = await createSubmission({ ...form, products });
      navigate(`/form/step2/${res.data.id}`, {
        state: { submissionId: res.data.id, products: res.data.products }
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = () => {
    setProducts([...products, { product_name: '', product_type: '' }]);
  };

  const updateProduct = (index, field, value) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
    if (errors[`product_name_${index}`] || errors[`product_type_${index}`]) {
      const newErrors = { ...errors };
      delete newErrors[`product_name_${index}`];
      delete newErrors[`product_type_${index}`];
      setErrors(newErrors);
    }
  };

  const removeProduct = (index) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleFieldChange = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <div className="step-number">Step 1 of 5</div>
        <h1>Company Information</h1>
        <p>Please provide your company details and the products you'd like to submit for compliance review.</p>
      </div>

      {prefilled && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '0.875rem', color: '#166534' }}>
          Your company information and materials have been pre-filled. Please review and complete any missing fields.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card">
          <h3 className="section-title">
            <span className="section-icon">🏢</span>
            Company Details
          </h3>

          <div className="grid-2">
            <div className="form-group">
              <label>Company Legal Name <span className="required">*</span></label>
              <input
                type="text"
                value={form.company_name}
                onChange={e => handleFieldChange('company_name', e.target.value)}
                placeholder="e.g. Acme Lubricants Ltd."
                className={errors.company_name ? 'error' : ''}
              />
              {errors.company_name && <span className="error-msg">{errors.company_name}</span>}
            </div>

            <div className="form-group">
              <label>Country of Registration</label>
              <select
                value={form.country}
                onChange={e => handleFieldChange('country', e.target.value)}
              >
                <option value="">Select country...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Primary Contact Name <span className="required">*</span></label>
              <input
                type="text"
                value={form.contact_name}
                onChange={e => handleFieldChange('contact_name', e.target.value)}
                placeholder="e.g. John Smith"
                className={errors.contact_name ? 'error' : ''}
              />
              {errors.contact_name && <span className="error-msg">{errors.contact_name}</span>}
            </div>

            <div className="form-group">
              <label>Contact Email <span className="required">*</span></label>
              <input
                type="email"
                value={form.contact_email}
                onChange={e => handleFieldChange('contact_email', e.target.value)}
                placeholder="e.g. john.smith@company.com"
                className={errors.contact_email ? 'error' : ''}
              />
              {errors.contact_email && <span className="error-msg">{errors.contact_email}</span>}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="section-header-row">
            <h3 className="section-title">
              <span className="section-icon">📦</span>
              Products
            </h3>
            <div className="product-count-badge">{products.length} product{products.length !== 1 ? 's' : ''}</div>
          </div>

          <p style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
            Add all products you wish to submit for compliance review. Each product will require compliance documentation in the next step.
          </p>

          <div className="products-header">
            <span>Product Name</span>
            <span>Product Type</span>
          </div>

          <div className="products-list">
            {products.map((product, index) => (
              <div key={index}>
                <ProductRow
                  product={product}
                  index={index}
                  onChange={updateProduct}
                  onRemove={removeProduct}
                  canRemove={products.length > 1}
                />
                <div className="product-errors">
                  {errors[`product_name_${index}`] && (
                    <span className="error-msg">Product name is required</span>
                  )}
                  {errors[`product_type_${index}`] && (
                    <span className="error-msg">Product type is required</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-outline add-product-btn" onClick={addProduct}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Product
          </button>
        </div>

        <div className="step-actions">
          <div className="step-actions-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Your progress is saved automatically when you proceed.
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Saving...</> : 'Continue to Compliance →'}
          </button>
        </div>
      </form>
    </div>
  );
}
