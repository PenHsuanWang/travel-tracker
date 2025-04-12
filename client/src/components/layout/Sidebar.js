// client/src/components/layout/Sidebar.js
import React from 'react';
import UploadPanel from '../upload/UploadPanel';
import CategoriesPanel from '../categories/CategoriesPanel';
import '../../styles/Sidebar.css';

function Sidebar({ mapHtml, setMapHtml }) {
  return (
    <aside className="Sidebar">
      <UploadPanel />
      <CategoriesPanel mapHtml={mapHtml} setMapHtml={setMapHtml} />
    </aside>
  );
}

export default Sidebar;