// components/map/GPXDropdown.js
import React, { useEffect, useState } from 'react';
import {
  listGpxFiles,
  fetchGpxFile,
  generateMap
} from '../../services/api';
import '../../styles/GPXDropdown.css';

function GPXDropdown({ selectedLayer, setMapHtml }) {
  const [files, setFiles] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  /* fetch list once (or whenever dropdown opens) */
  const loadList = async () => {
    try {
      setFiles(await listGpxFiles());
    } catch (err) {
      console.error('Unable to list GPX files', err);
    }
  };

  /* open / close dropdown */
  const toggle = () => {
    if (!isOpen) loadList();
    setIsOpen(!isOpen);
  };

  /* ------- helpers ------- */

  /** parse first <trkpt lat="" lon=""> pair */
  const firstLatLon = (arrayBuffer) => {
    const txt = new TextDecoder().decode(arrayBuffer);
    const xml = new DOMParser().parseFromString(txt, 'application/xml');
    const pt  = xml.querySelector('trkpt');
    if (!pt)  return null;
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
  };

  /* handle click on a single file */
  const handleSelect = async (filename) => {
    try {
      const buf    = await fetchGpxFile(filename, 'gps-data'); // ArrayBuffer
      const center = firstLatLon(buf);
      if (!center) {
        alert('GPX has no valid track point');
        return;
      }
      const html = await generateMap(selectedLayer, center);
      setMapHtml(html);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to center on GPX', err);
    }
  };

  /* ------- render ------- */
  return (
    <div className="gpx-dropdown">
      <button onClick={toggle}>
        {isOpen ? 'Hide GPX files' : 'Show GPX files'}
      </button>

      {isOpen && (
        <ul className="gpx-list">
          {files.length === 0 ? (
            <li className="placeholder">No GPX uploaded.</li>
          ) : (
            files.map((f) => (
              <li key={f} onClick={() => handleSelect(f)}>
                {f}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default GPXDropdown;