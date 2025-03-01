import axios from 'axios';

// Create an Axios instance with a common base URL and default headers.
const apiClient = axios.create({
  baseURL: 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Upload file to the backend (works for both GPS and image uploads).
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/map/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// Get available map layers.
export const getMapLayers = async () => {
  const response = await apiClient.get('/map/layers');
  return response.data;
};

// Generate a map based on the selected layer.
export const generateMap = async (layer) => {
  const requestBody = { layer };
  const response = await apiClient.post('/map/generate_map', requestBody);
  return response.data;
};

export default apiClient;
