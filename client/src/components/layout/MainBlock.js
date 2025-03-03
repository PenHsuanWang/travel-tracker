// client/src/components/layout/MainBlock.js
import React from 'react';
import MapComponent from '../operations/MapComponent';
import DataListComponent from '../lists/DataListComponent';
import '../../styles/MainBlock.css';

function MainBlock() {
  return (
    <div className="MainBlock">
      <div className="MapArea">
        <MapComponent />
      </div>

      <div className="DataListArea" style={{ marginTop: '20px' }}>
        <DataListComponent />
      </div>
    </div>
  );
}

export default MainBlock;
