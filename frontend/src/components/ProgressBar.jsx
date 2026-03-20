import React from 'react';
import './ProgressBar.css';

const STEPS = [
  { number: 1, label: 'Company Info' },
  { number: 2, label: 'Compliance & Certs' },
  { number: 3, label: 'Allergens' },
  { number: 4, label: 'Declaration' }
];

export default function ProgressBar({ currentStep }) {
  return (
    <div className="progress-bar">
      {STEPS.map((step, index) => (
        <React.Fragment key={step.number}>
          <div className={`progress-step ${
            currentStep > step.number ? 'completed' :
            currentStep === step.number ? 'active' : 'upcoming'
          }`}>
            <div className="step-circle">
              {currentStep > step.number ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : step.number}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
          {index < STEPS.length - 1 && (
            <div className={`progress-connector ${currentStep > step.number + 1 || (currentStep > step.number) ? 'filled' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
