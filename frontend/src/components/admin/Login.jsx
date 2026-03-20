import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../../api';
import './Admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminLogin({ username, password });
      localStorage.setItem('adminToken', res.data.token);
      localStorage.setItem('adminUser', res.data.username);
      navigate('/admin');
    } catch (err) {
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-box">
        <div className="admin-login-logo">
          <span className="admin-logo-text">LUBRIPLATE</span>
          <span className="admin-logo-sub">Lubricants Company</span>
        </div>

        <div className="admin-login-card">
          <div className="admin-login-header">
            <div className="admin-lock-icon">🔒</div>
            <h2>Internal Portal</h2>
            <p>Quality Team Access</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="admin-error-alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <><span className="spinner" /> Signing in...</> : 'Sign In →'}
            </button>
          </form>
        </div>

        <p className="admin-login-footer">
          Supplier Compliance Portal &nbsp;•&nbsp; Lubriplate Lubricants Company
        </p>
      </div>
    </div>
  );
}
