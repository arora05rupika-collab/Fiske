import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubmission, updateStep4Compliance } from '../api';
import './Step.css';

const ROHS_SUBSTANCES = [
  { name: 'Cadmium (Cd)', limit: 100 },
  { name: 'Lead (Pb)', limit: 1000 },
  { name: 'Mercury (Hg)', limit: 1000 },
  { name: 'Hexavalent chromium (Cr6+)', limit: 1000 },
  { name: 'Polybrominated biphenyls (PBB)', limit: 1000 },
  { name: 'Polybrominated diphenyl ethers (PBDE)', limit: 1000 },
  { name: 'Bis(2-ethylhexyl) phthalate (DEHP)', limit: 1000 },
  { name: 'Butyl benzyl phthalate (BBP)', limit: 1000 },
  { name: 'Dibutyl phthalate (DBP)', limit: 1000 },
  { name: 'Diisobutyl phthalate (DIBP)', limit: 1000 },
];

const ROHS_OPTIONS = ['Compliant', 'Compliant with Exemption', 'Not Compliant', 'RoHS-not-concerned'];
const SVHC_OPTIONS = ['Do Not Contain', 'Contain SVHCs of no more than 1000ppm', 'Contain SVHCs of more than 1000ppm'];
const PFAS_OPTIONS = ['Yes', 'No'];

export default function Step4Compliance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [products, setProducts] = useState([]);

  // Per-product compliance state
  const [rohsData, setRohsData] = useState({});
  const [svhcData, setSvhcData] = useState({});
  const [pfasData, setPfasData] = useState({});
  const [fmdData, setFmdData] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const res = await getSubmission(id);
        const prods = res.data.products || [];
        setProducts(prods);

        // Initialize states per product
        const initRohs = {};
        const initSvhc = {};
        const initPfas = {};
        const initFmd = {};

        prods.forEach(p => {
          initRohs[p.id] = res.data.rohs_data?.[p.id] || { status: 'Compliant', exemption_ref: '' };
          initSvhc[p.id] = res.data.svhc_data?.[p.id] || { status: 'Do Not Contain', substance_name: '', cas_number: '' };
          initPfas[p.id] = res.data.pfas_data?.[p.id] || { contains_pfas: 'No' };
          initFmd[p.id] = res.data.fmd_data?.[p.id] || { fmd_doc: 'N/A' };
        });

        setRohsData(initRohs);
        setSvhcData(initSvhc);
        setPfasData(initPfas);
        setFmdData(initFmd);
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateStep4Compliance(id, {
        rohs_data: rohsData,
        svhc_data: svhcData,
        pfas_data: pfasData,
        fmd_data: fmdData
      });
      navigate(`/form/step5/${id}`);
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
        <p style={{ marginTop: '16px', color: '#666' }}>Loading compliance data...</p>
      </div>
    );
  }

  return (
    <div className="step-container">
      <div className="step-header">
        <div className="step-number">Step 4 of 5</div>
        <h1>EU Compliance Declarations</h1>
        <p>
          Complete the EU RoHS, SVHC, PFAS, and Full Material Declaration sections for each product listed.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* EU RoHS Declaration */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">🇪🇺</span>
            EU RoHS Declaration
          </h3>
          <div className="compliance-doc-ref">
            Document Number: RoHS10_EN_CoC_Template_01C
          </div>

          <div className="info-box" style={{ marginBottom: '16px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
              This certifies that all parts supplied meet the requirements of EU RoHS Directive 2011/65/EU
              and 2015/863/EU. The RoHS-10 substance list and maximum limits at homogeneous material level are:
            </p>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
            <table className="compliance-ref-table">
              <thead>
                <tr>
                  <th>Substance</th>
                  <th>Maximum Limit (ppm)</th>
                </tr>
              </thead>
              <tbody>
                {ROHS_SUBSTANCES.map(s => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td style={{ textAlign: 'center' }}>{s.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginBottom: '16px', fontStyle: 'italic' }}>
            Note: Maximum limit does not apply to applications for which exemptions have been granted by the EU RoHS directive Recast.
          </p>

          <h4 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Annex I &mdash; Product Compliance Status</h4>

          {products.map(p => (
            <div key={p.id} className="compliance-product-card">
              <div className="compliance-product-header" style={{
                background: 'var(--black)', color: 'white', padding: '10px 16px',
                borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <strong>{p.product_name}</strong>
                <span className={`compliance-product-type-badge ${p.product_type === 'Food Grade' ? '' : 'industrial'}`}>
                  {p.product_type}
                </span>
              </div>
              <div style={{ padding: '16px', border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                <div className="form-group">
                  <label>EU RoHS Compliance Status</label>
                  <select
                    value={rohsData[p.id]?.status || 'Compliant'}
                    onChange={e => setRohsData(prev => ({
                      ...prev,
                      [p.id]: { ...prev[p.id], status: e.target.value }
                    }))}
                  >
                    {ROHS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {rohsData[p.id]?.status === 'Compliant with Exemption' && (
                  <div className="form-group">
                    <label>Exemption Reference Number</label>
                    <input
                      type="text"
                      value={rohsData[p.id]?.exemption_ref || ''}
                      onChange={e => setRohsData(prev => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], exemption_ref: e.target.value }
                      }))}
                      placeholder="Enter exemption reference number"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* EU SVHC Compliance */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">🧪</span>
            EU SVHC (REACH) Compliance
          </h3>

          <div className="info-box" style={{ marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Substances of Very High Concern (SVHC) under REACH regulation.
              Indicate whether each product contains SVHCs above the 1000ppm threshold.
            </p>
          </div>

          {products.map(p => (
            <div key={p.id} className="compliance-product-card">
              <div className="compliance-product-header" style={{
                background: 'var(--black)', color: 'white', padding: '10px 16px',
                borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <strong>{p.product_name}</strong>
              </div>
              <div style={{ padding: '16px', border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                <div className="form-group">
                  <label>SVHC Compliance Status</label>
                  <select
                    value={svhcData[p.id]?.status || 'Do Not Contain'}
                    onChange={e => setSvhcData(prev => ({
                      ...prev,
                      [p.id]: { ...prev[p.id], status: e.target.value }
                    }))}
                  >
                    {SVHC_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {svhcData[p.id]?.status === 'Contain SVHCs of more than 1000ppm' && (
                  <div className="grid-2">
                    <div className="form-group">
                      <label>SVHC Substance Name</label>
                      <input
                        type="text"
                        value={svhcData[p.id]?.substance_name || ''}
                        onChange={e => setSvhcData(prev => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], substance_name: e.target.value }
                        }))}
                        placeholder="Substance name"
                      />
                    </div>
                    <div className="form-group">
                      <label>SVHC CAS #</label>
                      <input
                        type="text"
                        value={svhcData[p.id]?.cas_number || ''}
                        onChange={e => setSvhcData(prev => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], cas_number: e.target.value }
                        }))}
                        placeholder="CAS number"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* PFAS Material Declaration */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">🔬</span>
            PFAS Material Declaration
          </h3>
          <div className="compliance-doc-ref">
            Document Number: PFAS_EN_CoC_02F
          </div>

          <div className="info-box" style={{ marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Per- and Polyfluoroalkyl Substances (PFAS) declaration. PFAS refers to chemicals defined as
              a class of organic chemicals containing at least one fully fluorinated carbon atom, including
              intentionally added or naturally occurring. Products containing PFAS may also be subject to
              EPA TSCA Section 8(a)(7) reporting requirements.
            </p>
          </div>

          {products.map(p => (
            <div key={p.id} className="compliance-product-card">
              <div className="compliance-product-header" style={{
                background: 'var(--black)', color: 'white', padding: '10px 16px',
                borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <strong>{p.product_name}</strong>
              </div>
              <div style={{ padding: '16px', border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                <div className="form-group">
                  <label>Contains PFAS?</label>
                  <div className="toggle-group">
                    {PFAS_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        className={`toggle-btn ${pfasData[p.id]?.contains_pfas === opt
                          ? opt === 'Yes' ? 'active-yes' : 'active-no'
                          : ''}`}
                        onClick={() => setPfasData(prev => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], contains_pfas: opt }
                        }))}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {pfasData[p.id]?.contains_pfas === 'Yes' && (
                  <div className="info-box" style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400e' }}>
                      Products containing PFAS may be subject to TSCA Section 8(a)(7) reporting. Please ensure you have the necessary documentation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FMD - Full Material Declaration */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="section-title">
            <span className="section-icon">📋</span>
            Full Material Declaration (FMD)
          </h3>

          <div className="info-box" style={{ marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              A Full Material Declaration (FMD) describes the material composition used in the part so that
              compliance may be assessed for multiple regulations. If the part is a raw material, you may submit
              an MSDS or Material Certificate instead. Enter a URL, "as attached", or "N/A" if not available.
            </p>
          </div>

          {products.map(p => (
            <div key={p.id} className="compliance-product-card">
              <div className="compliance-product-header" style={{
                background: 'var(--black)', color: 'white', padding: '10px 16px',
                borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <strong>{p.product_name}</strong>
              </div>
              <div style={{ padding: '16px', border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                <div className="form-group">
                  <label>FMD Document</label>
                  <input
                    type="text"
                    value={fmdData[p.id]?.fmd_doc || ''}
                    onChange={e => setFmdData(prev => ({
                      ...prev,
                      [p.id]: { ...prev[p.id], fmd_doc: e.target.value }
                    }))}
                    placeholder='Enter URL, "as attached", or "N/A"'
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="step-actions">
          <button type="button" className="btn btn-outline step-back-btn" onClick={() => navigate(-1)}>
            &larr; Back
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Saving...</> : 'Continue to Declaration \u2192'}
          </button>
        </div>
      </form>
    </div>
  );
}
