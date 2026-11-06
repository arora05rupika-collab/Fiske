import React, { useState } from 'react';

export function FileUpload({ label, name, currentFile, onChange, required, hasError, multiple, currentLabel }) {
  const [fileName, setFileName] = useState('');

  const handleChange = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    setFileName(picked.map(f => f.name).join(', '));
    onChange(name, multiple ? picked : picked[0]);
  };

  return (
    <div className="form-group">
      <label>{label}{required && <span className="required"> *</span>}</label>
      <label className="file-upload-label">
        <div className={`file-upload-box ${fileName || currentFile ? 'has-file' : ''} ${hasError ? 'upload-error' : ''}`}>
          <input type="file" name={name} multiple={multiple} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleChange} />
          {(fileName || currentFile) && <div className="file-upload-icon">✓</div>}
          {fileName ? (
            <div className="file-name">{fileName}</div>
          ) : currentFile ? (
            <div className="file-name">{currentLabel || 'File already uploaded'} — click to replace</div>
          ) : (
            <div className="file-upload-text">Click to upload PDF, JPG, PNG, DOC<br />(max 20MB)</div>
          )}
        </div>
      </label>
    </div>
  );
}

export function ChoiceButtons({ value, onChange, options = ['Yes', 'No'], disabled }) {
  const activeClass = (opt) => {
    if (opt === 'Yes' || opt.startsWith('Yes')) return 'active-yes';
    if (opt === 'No') return 'active-no';
    return 'active-na';
  };
  return (
    <div className="toggle-group" style={{ flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          className={`toggle-btn ${value === opt ? activeClass(opt) : ''}`}
          onClick={() => onChange && onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function FormErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="form-error-banner" role="alert">
      {message}
    </div>
  );
}

export function apiErrorMessage(err) {
  return err?.response?.data?.error || 'Something went wrong while saving. Please check your connection and try again.';
}
