import React from 'react';
import {
  ALLERGENS, ROHS_OPTIONS, SVHC_OPTIONS, REACH_REFERENCES, ROHS_REFERENCES, DECLARATIONS, DECLARATION_OPTIONS,
} from '../../formConstants';
import { ChoiceButtons } from '../FormControls';
import { References } from '../Step4Compliance';
import '../Step.css';

function ViewFile({ label, path }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className={`view-file-box ${path ? 'has-file' : ''}`}>
        {path ? (
          <>✓ <a href={path} target="_blank" rel="noopener noreferrer">View uploaded file</a></>
        ) : 'No file uploaded'}
      </div>
    </div>
  );
}

function Field({ label, value, type = 'text' }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input type={type} value={value || ''} placeholder="Not provided" readOnly />
    </div>
  );
}

function StepHeader({ step, title, children }) {
  return (
    <div className="step-header">
      <div className="step-number">{step}</div>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

function TypeBadge({ type }) {
  return <span className={`compliance-product-type-badge ${type === 'Food Grade' ? '' : 'industrial'}`}>{type}</span>;
}

function ProductBox({ product, children }) {
  return (
    <div className="compliance-product-card">
      <div className="compliance-product-header" style={{ padding: '10px 16px' }}>
        <strong>{product.product_name}</strong>
        <TypeBadge type={product.product_type} />
      </div>
      <div style={{ padding: '16px', border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
        {children}
      </div>
    </div>
  );
}

export default function SubmissionFormView({ submission: s }) {
  const products = s.products || [];
  const allergenSel = {};
  (s.allergens || []).filter(a => a.in_product === 'Yes').forEach(a => {
    allergenSel[a.product_id] = [...(allergenSel[a.product_id] || []), a.allergen_code];
  });
  const declarations = s.declarations || {};
  const hasLegacyCerts = s.kosher_cert_file_path || s.halal_cert_file_path || s.regulatory_compliant;

  return (
    <div className="submission-form-view">
      <fieldset disabled>
        {/* Step 1 */}
        <div className="step-container">
          <StepHeader step="Step 1 of 5" title="Company Information" />
          <div className="card">
            <h3 className="section-title"><span className="section-icon">🏢</span>Company Details</h3>
            <div className="grid-2">
              <Field label="Company Legal Name" value={s.company_name} />
              <Field label="Country of Registration" value={s.country} />
            </div>
            <div className="grid-2">
              <Field label="Primary Contact Name" value={s.contact_name} />
              <Field label="Contact Email" value={s.contact_email} />
            </div>
            <div className="form-group">
              <label>Is your quality system certified?</label>
              <ChoiceButtons value={s.quality_certified} disabled />
            </div>
            {s.quality_certified === 'Yes' && (
              <Field label="Which certifications do you hold?" value={s.quality_certifications} />
            )}
          </div>

          <div className="card" style={{ marginTop: '20px' }}>
            <div className="section-header-row">
              <h3 className="section-title"><span className="section-icon">📦</span>Products</h3>
              <div className="product-count-badge">{products.length} product{products.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="products-header"><span>Product Name</span><span>Product Type</span></div>
            <div className="products-list">
              {products.map((p, i) => (
                <div key={p.id} className="product-row">
                  <div className="product-row-number">{i + 1}</div>
                  <div className="product-row-fields">
                    <div className="form-group mb-0"><input value={p.product_name || ''} readOnly /></div>
                    <div className="form-group mb-0"><input value={p.product_type || ''} readOnly /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2 — one page per product */}
        {products.map((p, i) => {
          const isFoodGrade = p.product_type === 'Food Grade';
          return (
            <div key={p.id} className="step-container">
              <StepHeader step={`Step 2 of 5 — Product ${i + 1} of ${products.length}`} title={p.product_name} />
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="section-header-row">
                  <h3 className="section-title"><span className="section-icon">📄</span>Product Documents</h3>
                  <TypeBadge type={p.product_type} />
                </div>
                <div className="grid-2">
                  <ViewFile label="SDS (Safety Data Sheet)" path={p.sds_file_path} />
                  <ViewFile label="TDS (Technical Data Sheet)" path={p.tds_file_path} />
                </div>
              </div>

              <div className="card" style={{ marginBottom: '20px' }}>
                <h3 className="section-title"><span className="section-icon">🔬</span>PFAS & MOAH</h3>
                <div className="question-block">
                  <label>Is this product PFAS free?</label>
                  <ChoiceButtons value={p.pfas_free} disabled />
                  <div style={{ marginTop: '12px' }}><ViewFile label="PFAS statement (optional)" path={p.pfas_file_path} /></div>
                </div>
                <div className="question-block">
                  <label>Is this product MOAH free (Mineral Oil Aromatic Hydrocarbons)?</label>
                  <ChoiceButtons value={p.moah_free} disabled />
                  <div style={{ marginTop: '12px' }}><ViewFile label="MOAH statement (optional)" path={p.moah_file_path} /></div>
                </div>
              </div>

              {isFoodGrade && (
                <div className="card" style={{ marginBottom: '20px' }}>
                  <h3 className="section-title"><span className="section-icon">🏅</span>Food Grade Certifications</h3>
                  <div className="question-block">
                    <label>Is this product Halal certified?</label>
                    <ChoiceButtons value={p.halal_certified} options={['Yes', 'No', 'N/A']} disabled />
                    {p.halal_certified === 'Yes' && (
                      <div className="grid-2" style={{ marginTop: '12px' }}>
                        <ViewFile label="Halal certificate" path={p.halal_cert_file_path} />
                        <Field label="Expiry date" type="date" value={p.halal_cert_expiry} />
                      </div>
                    )}
                  </div>
                  <div className="question-block">
                    <label>Is this product Kosher certified?</label>
                    <ChoiceButtons value={p.kosher_certified} options={['Yes', 'No', 'N/A']} disabled />
                    {p.kosher_certified === 'Yes' && (
                      <div className="grid-2" style={{ marginTop: '12px' }}>
                        <ViewFile label="Kosher certificate" path={p.kosher_cert_file_path} />
                        <Field label="Expiry date" type="date" value={p.kosher_cert_expiry} />
                      </div>
                    )}
                  </div>
                  <div className="question-block">
                    <label>NSF Certification</label>
                    <div className="grid-2">
                      <ViewFile label="NSF certificate" path={p.nsf_cert_file_path} />
                      <div>
                        <Field label="NSF expiry date" type="date" value={p.nsf_cert_expiry} />
                        <Field label="NSF registration number" value={p.nsf_registration_number} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {hasLegacyCerts && (
          <div className="step-container">
            <div className="card">
              <h3 className="section-title"><span className="section-icon">🗂</span>Answers from the previous form version</h3>
              {s.regulatory_compliant && (
                <div className="grid-2">
                  <Field label="Compliant with applicable regulations?" value={s.regulatory_compliant} />
                  <Field label="Regulatory penalties in last 3 years?" value={s.regulatory_penalties} />
                </div>
              )}
              <div className="grid-2">
                <ViewFile label="Kosher certificate (all food grade products)" path={s.kosher_cert_file_path} />
                <ViewFile label="Halal certificate (all food grade products)" path={s.halal_cert_file_path} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        <div className="step-container">
          <StepHeader step="Step 3 of 5" title="Allergen Declaration" />
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="section-title"><span className="section-icon">🧪</span>Allergen List</h3>
            <div className="allergen-table-wrapper" style={{ marginBottom: '24px' }}>
              <table className="allergen-table">
                <thead><tr><th style={{ width: '48px' }}>#</th><th className="allergen-name-col">Allergen</th></tr></thead>
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
              <label>Do any of your products contain any of the allergens listed above?</label>
              <ChoiceButtons value={s.allergens_in_products} disabled />
            </div>
            {s.allergens_in_products === 'Yes' && (
              <div className="question-block">
                <label>Allergens each product contains</label>
                {products.map(p => (
                  <div key={p.id} className="product-allergen-row">
                    <h4>{p.product_name} <TypeBadge type={p.product_type} /></h4>
                    <div className="allergen-chip-grid">
                      {ALLERGENS.map(a => {
                        const isSel = (allergenSel[p.id] || []).includes(a.code);
                        return (
                          <button key={a.code} type="button" className={`allergen-chip ${isSel ? 'selected' : ''}`} style={isSel ? undefined : { opacity: 0.5 }}>
                            {isSel ? '✓ ' : ''}{a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="question-block">
              <label>Are any of these allergens present in your plant or production facility?</label>
              <ChoiceButtons value={s.allergens_in_plant} options={['Yes', 'No', 'N/A']} disabled />
            </div>
          </div>

          <div className="card">
            <h3 className="section-title"><span className="section-icon">🏭</span>Facility Practices</h3>
            <div className="question-block">
              <label>Do you have documented procedures to prevent cross-contamination?</label>
              <ChoiceButtons
                value={s.cross_contamination_procedures}
                options={['Yes - fully documented', 'Partially - under development', 'No']}
                disabled
              />
            </div>
            <div className="question-block">
              <label>Do any of your packaging materials use wheat-starch release agents?</label>
              <ChoiceButtons value={s.wheat_starch_packaging} disabled />
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="step-container">
          <StepHeader step="Step 4 of 5" title="EU Compliance Declarations" />
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="section-title"><span className="section-icon">🧪</span>REACH — Substances of Very High Concern (SVHC)</h3>
            <References items={REACH_REFERENCES} />
            {products.map(p => {
              const svhc = s.svhc_data?.[p.id] || {};
              return (
                <ProductBox key={p.id} product={p}>
                  <div className="form-group">
                    <label>SVHC status</label>
                    <select value={svhc.status || ''} disabled>
                      <option value="">Not provided</option>
                      {SVHC_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  {svhc.status === 'Contain SVHCs of more than 1000ppm' && (
                    <div className="grid-2">
                      <Field label="SVHC substance name" value={svhc.substance_name} />
                      <Field label="SVHC CAS #" value={svhc.cas_number} />
                    </div>
                  )}
                </ProductBox>
              );
            })}
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="section-title"><span className="section-icon">⚡</span>1. RoHS</h3>
            <References items={ROHS_REFERENCES} />
            {products.map(p => {
              const rohs = s.rohs_data?.[p.id] || {};
              return (
                <ProductBox key={p.id} product={p}>
                  <div className="form-group">
                    <label>RoHS compliance status</label>
                    <select value={rohs.status || ''} disabled>
                      <option value="">Not provided</option>
                      {ROHS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  {rohs.status === 'Compliant with Exemption' && <Field label="Exemption reference number" value={rohs.exemption_ref} />}
                </ProductBox>
              );
            })}
          </div>

          {DECLARATIONS.map((d, i) => (
            <div key={d.key} className="card" style={{ marginBottom: '20px' }}>
              <h3 className="section-title"><span className="section-icon">📋</span>{i + 2}. {d.title}</h3>
              <div className="declaration-box" style={{ marginBottom: '4px' }}><p>{d.statement}</p></div>
              <References items={d.references} />
              <div className="question-block">
                <label>Do all products in this submission meet this declaration?</label>
                <ChoiceButtons value={declarations[d.key]?.answer} options={DECLARATION_OPTIONS} disabled />
                {declarations[d.key]?.answer === 'No' && (
                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label>Which products do not comply, and why?</label>
                    <textarea rows={3} value={declarations[d.key]?.details || ''} readOnly />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Step 5 */}
        <div className="step-container">
          <StepHeader step="Step 5 of 5" title="Declaration & Signature" />
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="section-title"><span className="section-icon">📜</span>Legal Declaration</h3>
            <div className="declaration-box">
              <p>
                I, the undersigned, on behalf of the supplier named in this submission, hereby declare that all
                information, certifications, and allergen disclosures provided are accurate, complete, and truthful
                to the best of my knowledge. All uploaded documents are valid and have not expired at the date of
                submission. I confirm I am authorised to sign this declaration on behalf of my organisation.
              </p>
            </div>
            <div className="grid-2">
              <Field label="Signatory Full Name" value={s.signatory_name} />
              <Field label="Job Title" value={s.signatory_title} />
            </div>
            <Field
              label="Date"
              value={s.submission_date ? new Date(s.submission_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
            />
          </div>
          <div className="card">
            <h3 className="section-title"><span className="section-icon">✍️</span>Signature</h3>
            {s.signature_image_path ? (
              <div className="signature-area" style={{ padding: '12px', textAlign: 'center' }}>
                <img src={s.signature_image_path} alt="Supplier signature" style={{ maxWidth: '100%', maxHeight: '180px' }} />
              </div>
            ) : (
              <p style={{ color: 'var(--gray-500)' }}>Not signed yet — the supplier has not submitted the form.</p>
            )}
            <label className="checkbox-group" style={{ marginTop: '16px' }}>
              <input type="checkbox" checked={!!s.submission_date} readOnly />
              <span style={{ fontSize: '0.9rem', color: 'var(--gray-700)' }}>
                I confirm I am authorised to submit this form on behalf of my company and that all information provided is accurate and complete.
              </span>
            </label>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
