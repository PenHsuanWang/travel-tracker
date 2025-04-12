// client/src/App.js
import React, { useState } from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainBlock from './components/layout/MainBlock';
import Footer from './components/layout/Footer';
import './styles/App.css';

function App() {
  // Shared state for the map
  const [selectedLayer, setSelectedLayer] = useState('openstreetmap');
  const [mapHtml, setMapHtml] = useState('');

  return (
    <div className="App">
      <Header />
      <div className="App-body">
        {/* Sidebar now composed of UploadPanel & CategoriesPanel */}
        <Sidebar mapHtml={mapHtml} setMapHtml={setMapHtml} />
        {/* Main content area for map and lists */}
        <MainBlock
          selectedLayer={selectedLayer}
          setSelectedLayer={setSelectedLayer}
          mapHtml={mapHtml}
          setMapHtml={setMapHtml}
        />
      </div>
      <Footer />
    </div>
  );
}

export default App;