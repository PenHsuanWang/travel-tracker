// client/src/components/layout/Header.js
import React from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/Header.css';

function Header() {
  return (
    <header className="main-header" role="banner">
      <div className="header-inner">
        <div className="brand">
          <div className="logo-mark" aria-hidden="true">⛰</div>
          <div className="brand-name">
            <div className="brand-title">Travel Tracker</div>
            <div className="brand-subtitle">Trip manager</div>
          </div>
        </div>

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
          <button type="button" className="nav-link muted" title="Settings coming soon">
            Settings
          </button>
        </nav>

        <div className="header-actions">
          <button type="button" className="nav-link muted" title="Profile">
            <span className="avatar">TT</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
