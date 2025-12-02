// client/src/components/layout/Header.js
import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl } from '../../services/api';
import '../../styles/Header.css';

function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const avatarSrc = user?.avatar_url 
    ? (user.avatar_url.startsWith('http') ? user.avatar_url : getImageUrl(user.avatar_url))
    : '/default-avatar.svg';

  return (
    <header className="main-header" role="banner">
      <div className="header-inner">
        <Link to="/" className="brand">
          <div className="logo-mark" aria-hidden="true">⛰</div>
          <div className="brand-name">
            <div className="brand-title">Travel Tracker</div>
            <div className="brand-subtitle">Trip manager</div>
          </div>
        </Link>

        <nav className="nav-links" aria-label="Primary navigation">
          <NavLink
            to="/trips"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Trips
          </NavLink>
          <button type="button" className="nav-link muted" title="Map view coming soon">
            Map
          </button>
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <div className="auth-controls">
              <Link to="/profile/me" className="user-profile-link">
                {avatarSrc && (
                  <img src={avatarSrc} alt="" className="header-avatar" />
                )}
                <span className="user-greeting">{user?.username}</span>
              </Link>
              <button 
                type="button" 
                className="nav-link" 
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-controls">
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link primary">Register</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
