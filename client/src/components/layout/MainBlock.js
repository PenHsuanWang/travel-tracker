// client/src/components/layout/MainBlock.js
import React from 'react';
import MapComponent from '../operations/MapComponent';
import DataListComponent from '../lists/DataListComponent';
import '../../styles/MainBlock.css';

function MainBlock({
  selectedLayer,
  setSelectedLayer,
  mapHtml,
  setMapHtml
}) {
  return (
    <div className="MainBlock">
      <div className="MapArea">
        <MapComponent
          selectedLayer={selectedLayer}
          setSelectedLayer={setSelectedLayer}
          mapHtml={mapHtml}
          setMapHtml={setMapHtml}
        />
      </div>
      <div className="DataListArea">
        <DataListComponent />
      </div>
    </div>
  );
}

export default MainBlock;
