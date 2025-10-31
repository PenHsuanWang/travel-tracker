import React, { useState } from 'react';
import '../../styles/Sidebar.css';
import SearchBar     from '../sidebar/SearchBar';
import RiverSelector from '../sidebar/RiverSelector';
import UploadPanel   from '../sidebar/UploadPanel';

function Sidebar({
  selectedLayer,
  setSelectedLayer,
  selectedRivers,
  setSelectedRivers,
  setMapHtml,
}) {
  /** local state for the top “global” search -- you can
   *  forward it to RiverSelector later if desired            */
  const [search, setSearch] = useState('');

  return (
    <aside className="sidebar">
      <SearchBar query={search} setQuery={setSearch} />

      <RiverSelector
        selectedLayer={selectedLayer}
        selectedRivers={selectedRivers}
        setSelectedRivers={setSelectedRivers}
        setMapHtml={setMapHtml}
        /** (optional) forward the search term
         *  filter={search}
         */
      />

      <UploadPanel setMapHtml={setMapHtml} />
    </aside>
  );
}

export default Sidebar;