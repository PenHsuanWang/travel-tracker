import React from 'react';
import '../../styles/MainArea.css';
import MapContainer from '../map/MapContainer';

function MainArea({ mapHtml }) {
  return (
    <main className="main-area">
      <MapContainer mapHtml={mapHtml} />
    </main>
  );
}

export default MainArea;