import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapComponent = () => {
  const markers = [
    { position: [51.505, -0.09], popup: "A pretty CSS3 popup. <br> Easily customizable." }
  ];

  useEffect(() => {
    // Initialize map or any map-related logic here
  }, []);

  return (
    <MapContainer center={[51.505, -0.09]} zoom={13} className="MapContainer">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      />
      {markers.map((marker, index) => (
        <Marker key={index} position={marker.position}>
          <Popup>{marker.popup}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapComponent;