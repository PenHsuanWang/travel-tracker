// client/src/components/layout/Footer.js
import React from 'react';
import '../../styles/Footer.css';

function Footer() {
  return (
    <footer className="App-footer">
      <p>© 2023 Your Map App. All Rights Reserved.</p>
      <ul>
        <li><a href="/privacy-policy">Privacy Policy</a></li>
        <li><a href="/terms-and-conditions">Terms and Conditions</a></li>
      </ul>
    </footer>
  );
}

export default Footer;