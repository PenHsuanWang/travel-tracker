// client/src/components/layout/Sidebar.js
import React from 'react';
import UploadPanel from '../panels/UploadPanel';
import CategoriesPanel from '../panels/CategoriesPanel';
import '../../styles/Sidebar.css';

function Sidebar({ selectedLayer, mapHtml, setMapHtml }) {
  return (
    <aside className="Sidebar">
      {/* Upload Data Panel */}
      <UploadPanel />

      {/* Categories Panel (e.g. Rivers, Mountains, Highways) */}
      <CategoriesPanel
        selectedLayer={selectedLayer}
        mapHtml={mapHtml}
        setMapHtml={setMapHtml}
      />

      {/* Optionally, a “Generate GIS Map” button if you prefer a manual approach */}
      {/*
        <button onClick={() => { ... }}>Generate GIS Map</button>
      */}
    </aside>
  );
}

export default Sidebar;