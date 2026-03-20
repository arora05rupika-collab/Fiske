import React from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import ProgressBar from './ProgressBar';
import './FormLayout.css';

export default function FormLayout() {
  const location = useLocation();

  // Determine current step from path
  const path = location.pathname;
  let currentStep = 1;
  if (path.includes('step2')) currentStep = 2;
  else if (path.includes('step3')) currentStep = 3;
  else if (path.includes('step4')) currentStep = 4;

  return (
    <div className="form-layout">
      {/* Header */}
      <header className="form-header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <span className="logo-text">LUBRIPLATE</span>
              <span className="logo-sub">Lubricants Company</span>
            </div>
            <div className="header-right">
              <span className="portal-label">Supplier Compliance Portal</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="progress-section">
        <div className="container">
          <ProgressBar currentStep={currentStep} />
        </div>
      </div>

      {/* Main content */}
      <main className="form-main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="form-footer">
        <div className="container">
          <p>© {new Date().getFullYear()} Lubriplate Lubricants Company. All rights reserved.</p>
          <p>For assistance, contact: <a href="mailto:quality@lubriplate.com">quality@lubriplate.com</a></p>
        </div>
      </footer>
    </div>
  );
}
