// components/map/MapContainer.js
import React, { useEffect } from 'react';
import { generateMap } from '../../services/api';   // <-- import it
import MapToolbar   from './MapToolbar';
import GPXDropdown  from './GPXDropdown';
import '../../styles/MapContainer.css';

function MapContainer({
  selectedLayer,
  setSelectedLayer,
  mapHtml,
  setMapHtml,
}) {
  /* --------------------------------------------------
     ①  Generate an initial map once on first render
     -------------------------------------------------- */
  useEffect(() => {
    if (mapHtml) return;        // already have something – skip
    (async () => {
      try {
        const html = await generateMap(selectedLayer, null); // no center
        setMapHtml(html);
      } catch (err) {
        console.error('Initial map generation failed', err);
      }
    })();
    // run once – so no deps except functions guaranteed stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ② regenerate map when layer changes ------- */
  useEffect(() => {
    (async () => {
      try {
        const html = await generateMap(selectedLayer, null);
        setMapHtml(html);
      } catch (err) {
        console.error('Layer-change map generation failed', err);
      }
    })();
  }, [selectedLayer]);

  /* -------------------------------------------------- */
  return (
    <div className="map-container">
      <MapToolbar
        selectedLayer={selectedLayer}
        setSelectedLayer={setSelectedLayer}
      />
      <GPXDropdown
        selectedLayer={selectedLayer}
        setMapHtml={setMapHtml}
      />
      <div
        className="map-view"
        dangerouslySetInnerHTML={{ __html: mapHtml }}
      />
    </div>
  );
}

export default MapContainer;