// client/src/components/layout/Sidebar.js
import React from 'react';
import UploadPanel from '../upload/UploadPanel';
import CategoriesPanel from '../categories/CategoriesPanel';
import '../../styles/Sidebar.css';

function Sidebar({ selectedLayer, mapHtml, setMapHtml }) {
  return (
    <aside className="Sidebar dashboard-sidebar">
      <div className="sidebar-nav">
        <div className="sidebar-content">
          <UploadPanel />
          <div className="sidebar-card">
            <CategoriesPanel
              selectedLayer={selectedLayer}
              mapHtml={mapHtml}
              setMapHtml={setMapHtml}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;