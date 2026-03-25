import React from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import './Confirmation.css';

export default function Confirmation() {
  const { id } = useParams();
  const location = useLocation();
  const state = location.state || {};

  const { reference_number, company_name, contact_email } = state;

  return (
    <div className="confirmation-page">
      <header className="conf-header">
        <div className="conf-logo">
          <span className="conf-logo-text">LUBRIPLATE</span>
          <span className="conf-logo-sub">Lubricants Company</span>
        </div>
      </header>

      <main className="conf-main">
        <div className="conf-card">
          <div className="conf-checkmark">
            <svg viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="25" fill="#16a34a" />
              <polyline points="14 26 22 34 38 18" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="conf-title">Submission Complete!</h1>
          <p className="conf-subtitle">
            Thank you{company_name ? `, ${company_name}` : ''}. Your compliance submission has been received.
          </p>

          <div className="conf-details">
            {reference_number && (
              <div className="conf-ref">
                <span className="conf-ref-label">Reference Number</span>
                <span className="conf-ref-value">{reference_number}</span>
              </div>
            )}

            {contact_email && (
              <p className="conf-email-note">
                📧 A confirmation email has been sent to <strong>{contact_email}</strong>
              </p>
            )}
          </div>

          <div className="conf-next">
            <h3>What happens next?</h3>
            <ol>
              <li>Our quality team will review your submission</li>
              <li>We may contact you if additional information is required</li>
              <li>You will be notified of the approval status by email</li>
            </ol>
          </div>

          <div className="conf-actions">
            <Link to="/form/step1" className="btn btn-outline">
              Submit Another Form
            </Link>
            <a href="https://lubriplate.com" className="btn btn-black" target="_blank" rel="noopener noreferrer">
              Visit Lubriplate.com
            </a>
          </div>
        </div>
      </main>

      <footer className="conf-footer">
        <p>© {new Date().getFullYear()} Lubriplate Lubricants Company. All rights reserved.</p>
        <p>Questions? Contact <a href="mailto:rarora@lubriplate.com">rarora@lubriplate.com</a></p>
      </footer>
    </div>
  );
}
