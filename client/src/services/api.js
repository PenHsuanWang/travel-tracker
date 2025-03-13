// client/src/services/api.js

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Existing exports
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/map/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getMapLayers = async () => {
  const response = await apiClient.get('/map/layers');
  return response.data;
};

export const generateMap = async (layer, center = null) => {
  const requestBody = {
    layer,
    center,
  };
  const response = await apiClient.post('/map/generate_map', requestBody);
  return response.data; // HTML string
};

export const getUploadedData = async () => {
  // Hypothetical endpoint if you store uploaded data info
  const response = await apiClient.get('/data');
  return response.data;
};

export const searchLocations = async (query) => {
  const response = await apiClient.get('/map/search', { params: { q: query } });
  return response.data;
};

export const listGpxFiles = async () => {
  const response = await apiClient.get('/list-files');
  return response.data;
};

export const fetchGpxFile = async (filename, bucket = 'gps-data') => {
  const response = await apiClient.get(`/files/${encodeURIComponent(filename)}`, {
    params: { bucket },
    responseType: 'arraybuffer',
  });
  return response.data;
};

// 1) LIST RIVERS: call the new GET /api/gis/list_rivers
export const listRivers = async () => {
  const response = await apiClient.get('/gis/list_rivers');
  return response.data;  // array of river names
};

// 2) GENERATE GIS MAP: call the new POST /api/gis/generate_gis_map
export const generateGisMap = async (layer, center = null, selectedRivers = []) => {
  const requestBody = {
    layer,
    center,
    selected_rivers: selectedRivers,
  };
  const response = await apiClient.post('/gis/generate_gis_map', requestBody);
  return response.data; // HTML string
};

// NEW: fetch map metadata (layers, default center) from /api/map/metadata
export const getMapMetadata = async () => {
  const response = await apiClient.get('/map/metadata');
  return response.data; // e.g. { availableLayers: [...], defaultCenter: [lat, lon] }
};

export default apiClient;
