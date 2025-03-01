import React from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainBlock from './components/layout/MainBlock';
import Footer from './components/layout/Footer';
import './styles/App.css';

function App() {
  return (
    <div className="App">
      <Header />
      <div className="App-body">
        <Sidebar />
        <MainBlock />
      </div>
      <Footer />
    </div>
  );
}

export default App;
