// client/src/components/layout/Sidebar.js
import React from 'react';
import UploadPanel from '../upload/UploadPanel';
import CategoriesPanel from '../categories/CategoriesPanel';
import '../../styles/Sidebar.css';

function Sidebar({ selectedLayer, mapHtml, setMapHtml }) {
  return (
    <aside className="Sidebar">
      {/* Panel for uploading data */}
      <UploadPanel />
      {/* Panel for selecting from multiple GIS data categories (rivers, mountains, etc.) */}
      <CategoriesPanel
        selectedLayer={selectedLayer}
        mapHtml={mapHtml}
        setMapHtml={setMapHtml}
      />
    </aside>
  );
}

export default Sidebar;