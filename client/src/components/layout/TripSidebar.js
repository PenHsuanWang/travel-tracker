import React from 'react';
import UploadPanel from '../panels/UploadPanel';
import ImageGalleryPanel from '../panels/ImageGalleryPanel';
import CategoriesPanel from '../panels/CategoriesPanel';
import '../../styles/Sidebar.css';

function TripSidebar({ tripId, selectedRivers, setSelectedRivers }) {
    return (
        <aside className="Sidebar">
            {/* Upload Data Panel - Trip Scoped */}
            <UploadPanel tripId={tripId} />

            {/* Image Gallery Panel - Trip Scoped */}
            <ImageGalleryPanel tripId={tripId} />

            {/* Categories Panel (Global Rivers) */}
            <CategoriesPanel
                selectedRivers={selectedRivers}
                setSelectedRivers={setSelectedRivers}
            />
        </aside>
    );
}

export default TripSidebar;
