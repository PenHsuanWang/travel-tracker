// client/src/components/layout/MainBlock.js
import React from 'react';
import LeafletMapView from '../views/LeafletMapView';
import '../../styles/MainBlock.css';

function MainBlock({ selectedLayer, setSelectedLayer, selectedRivers }) {
  return (
    <div className="MainBlock">
      <div className="MapArea">
        <LeafletMapView
          selectedLayer={selectedLayer}
          setSelectedLayer={setSelectedLayer}
          selectedRivers={selectedRivers}
        />
      </div>
    </div>
  );
}

export default MainBlock;
