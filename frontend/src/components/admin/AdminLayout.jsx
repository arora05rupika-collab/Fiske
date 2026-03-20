import React from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import './Admin.css';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem('adminUser') || 'Admin';

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-header-left">
            <Link to="/admin" className="admin-logo">
              <span className="admin-logo-text">LUBRIPLATE</span>
              <span className="admin-logo-sub">Quality Portal</span>
            </Link>
          </div>
          <nav className="admin-nav">
            <Link
              to="/admin"
              className={`admin-nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
              Dashboard
            </Link>
          </nav>
          <div className="admin-header-right">
            <div className="admin-user-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              {username}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
