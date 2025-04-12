// client/src/components/layout/MainBlock.js
import React from 'react';
import MapView from '../views/MapView';
import '../../styles/MainBlock.css';

function MainBlock({ selectedLayer, setSelectedLayer, mapHtml, setMapHtml }) {
  return (
    <div className="MainBlock">
      <div className="MapArea">
        <MapView
          selectedLayer={selectedLayer}
          setSelectedLayer={setSelectedLayer}
          mapHtml={mapHtml}
          setMapHtml={setMapHtml}
        />
      </div>
    </div>
  );
}

export default MainBlock;