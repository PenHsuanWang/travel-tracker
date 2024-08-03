import React from 'react';
import MapComponent from '../operations/MapComponent';
import '../../styles/MainBlock.css';

function MainBlock() {
  return (
    <div className="MainBlock">
      <div className="MapArea">
        <MapComponent />
      </div>
    </div>
  );
}

export default MainBlock;