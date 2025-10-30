// client/src/components/layout/Sidebar.js
import React from 'react';
import UploadPanel from '../panels/UploadPanel';
import CategoriesPanel from '../panels/CategoriesPanel';
import '../../styles/Sidebar.css';

function Sidebar({ selectedRivers, setSelectedRivers }) {
  return (
    <aside className="Sidebar">
      {/* Upload Data Panel */}
      <UploadPanel />

      {/* Categories Panel (e.g. Rivers, Mountains, Highways) */}
      <CategoriesPanel
        selectedRivers={selectedRivers}
        setSelectedRivers={setSelectedRivers}
      />
    </aside>
  );
}

export default Sidebar;
