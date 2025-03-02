// client/src/services/api.js

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Existing calls
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
  // center should be an array [lat, lon] or null
  const requestBody = {
    layer,
    center, // might be null or [lat, lon]
  };
  const response = await apiClient.post('/map/generate_map', requestBody);
  return response.data; // map HTML string
};

// Existing function to get "uploaded data" from your older endpoint
export const getUploadedData = async () => {
  const response = await apiClient.get('/data');
  return response.data;
};

// (Optional) If you have a search endpoint
export const searchLocations = async (query) => {
  const response = await apiClient.get('/map/search', { params: { q: query } });
  return response.data;
};

// List GPX files from MinIO (bucket = "gps-data" by default)
export const listGpxFiles = async () => {
  // calls the new route that lists keys in `gps-data`
  const response = await apiClient.get('/list-files'); 
  return response.data;  // array of file names, e.g. ["track1.gpx", "track2.gpx"]
};

export const fetchGpxFile = async (filename, bucket = 'gps-data') => {
  const response = await apiClient.get(`/files/${encodeURIComponent(filename)}`, {
    params: { bucket },
    responseType: 'arraybuffer', // important for binary data
  });
  return response.data; // ArrayBuffer
};



export default apiClient;
