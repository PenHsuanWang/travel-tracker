// client/src/App.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import TripsPage from './components/views/TripsPage';
import TripDetailPage from './components/views/TripDetailPage';
import './styles/App.css';

function App() {
  return (
    <div className="App">
      <Header />
      <div className="App-body">
        <Routes>
          <Route path="/" element={<Navigate to="/trips" replace />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;
