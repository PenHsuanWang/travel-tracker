// client/src/services/api.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/map/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getFileMetadata = async (metadataId) => {
  const response = await apiClient.get(`/map/metadata/${metadataId}`);
  return response.data;
};

export const deleteImage = async (filename, bucket = 'images') => {
  const response = await apiClient.delete(`/map/delete/${encodeURIComponent(filename)}`, {
    params: { bucket }
  });
  return response.data;
};

export const getMapLayers = async () => {
  const response = await apiClient.get('/map/layers');
  return response.data;
};

export const generateMap = async (layer, center = null) => {
  const requestBody = { layer, center };
  const response = await apiClient.post('/map/generate_map', requestBody);
  return response.data;
};

export const getUploadedData = async () => {
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

export const listRivers = async () => {
  const response = await apiClient.get('/gis/list_rivers');
  return response.data;
};

export const generateGisMap = async (layer, center = null, selectedRivers = []) => {
  const requestBody = { layer, center, selected_rivers: selectedRivers };
  const response = await apiClient.post('/gis/generate_gis_map', requestBody);
  return response.data;
};

export const getMapMetadata = async () => {
  const response = await apiClient.get('/map/metadata');
  return response.data;
};

export const riversData = async () => {
  const response = await apiClient.get('/gis/rivers_data');
  return response.data;
};

export const listImageFiles = async () => {
  const response = await apiClient.get('/list-files/detail', {
    params: { bucket: 'images' }
  });
  return response.data;
};

export const getImageUrl = (filename) => {
  return `${apiClient.defaults.baseURL}/files/${encodeURIComponent(filename)}?bucket=images`;
};

export default apiClient;