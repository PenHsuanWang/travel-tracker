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

export const generateMap = async (layer) => {
  const requestBody = { layer };
  const response = await apiClient.post('/map/generate_map', requestBody);
  return response.data;
};

// NEW: Fetch list of uploaded data items
export const getUploadedData = async () => {
  // For example, if your backend exposes an endpoint like GET /api/data
  // that returns an array of data items:
  const response = await apiClient.get('/data');
  return response.data;
};

export default apiClient;
