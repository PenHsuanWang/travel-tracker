// client/src/components/layout/Footer.js
import React from 'react';
import '../../styles/Footer.css';

function Footer() {
  return (
    <footer className="main-footer" role="contentinfo">
      <div className="footer-inner">
        <span>© 2025 HikeNote</span>
        <div className="footer-links">
          <a href="#about">About</a>
          <a href="#privacy">Privacy</a>
          <a href="#contact">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
