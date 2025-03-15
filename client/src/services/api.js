// client/src/services/api.js

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Upload a file (GPS or image)
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/map/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// Get base map layers
export const getMapLayers = async () => {
  const response = await apiClient.get('/map/layers');
  return response.data;
};

// Generate the Folium map HTML
export const generateMap = async (layer, center = null) => {
  const requestBody = { layer, center };
  const response = await apiClient.post('/map/generate_map', requestBody);
  return response.data; // HTML string
};

// (Optional) If you have a data endpoint for uploaded data
export const getUploadedData = async () => {
  const response = await apiClient.get('/data');
  return response.data;
};

// (Optional) If you have a location search endpoint
export const searchLocations = async (query) => {
  const response = await apiClient.get('/map/search', { params: { q: query } });
  return response.data;
};

// List GPX files from MinIO
export const listGpxFiles = async () => {
  const response = await apiClient.get('/list-files');
  return response.data;
};

// Fetch a specific GPX file as arraybuffer
export const fetchGpxFile = async (filename, bucket = 'gps-data') => {
  const response = await apiClient.get(`/files/${encodeURIComponent(filename)}`, {
    params: { bucket },
    responseType: 'arraybuffer',
  });
  return response.data;
};

// Old approach for listing rivers / generating GIS map (still available if needed)
export const listRivers = async () => {
  const response = await apiClient.get('/gis/list_rivers');
  return response.data;
};

export const generateGisMap = async (layer, center = null, selectedRivers = []) => {
  const requestBody = { layer, center, selected_rivers: selectedRivers };
  const response = await apiClient.post('/gis/generate_gis_map', requestBody);
  return response.data; // HTML string
};

// NEW: fetch map metadata (layers, default center) from /api/map/metadata
export const getMapMetadata = async () => {
  const response = await apiClient.get('/map/metadata');
  return response.data; // e.g. { availableLayers: [...], defaultCenter: [lat, lon] }
};

// Fetch all rivers as raw GeoJSON (cached + simplified on the server)
export const riversData = async () => {
  const response = await apiClient.get('/gis/rivers_data');
  return response.data; // { "RiverA": {...}, "RiverB": {...}, ...}
};

export default apiClient;
