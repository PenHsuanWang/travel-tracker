// client/src/services/api.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Trip API ---

export const createTrip = async (tripData) => {
  const response = await apiClient.post('/trips/', tripData);
  return response.data;
};

export const getTrips = async () => {
  const response = await apiClient.get('/trips/');
  return response.data;
};

export const getTrip = async (tripId) => {
  const response = await apiClient.get(`/trips/${tripId}`);
  return response.data;
};

export const updateTrip = async (tripId, tripData) => {
  const response = await apiClient.put(`/trips/${tripId}`, tripData);
  return response.data;
};

export const deleteTrip = async (tripId) => {
  await apiClient.delete(`/trips/${tripId}`);
};

// --- File API ---

export const uploadFile = async (file, tripId = null) => {
  try {
    console.log('[API] Uploading file:', file.name, file.type, file.size, 'Trip:', tripId);
    const formData = new FormData();
    formData.append('file', file);

    const params = {};
    if (tripId) {
      params.trip_id = tripId;
    }

    console.log('[API] Sending POST to:', `${apiClient.defaults.baseURL}/map/upload`);
    const response = await apiClient.post('/map/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: params,
    });

    console.log('[API] Upload successful, response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] Upload failed:', error);
    if (error.response) {
      console.error('[API] Server responded with error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('[API] No response received:', error.request);
    } else {
      console.error('[API] Error setting up request:', error.message);
    }
    throw error;
  }
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

export const listGpxFiles = async (tripId = null) => {
  const params = {};
  if (tripId) {
    params.trip_id = tripId;
  }
  // Note: The backend endpoint is /list-files, but it returns just keys.
  // If we want metadata/trip filtering, we might need to use /list-files/detail or update /list-files.
  // The current /list-files endpoint in retrieval service just lists keys from MinIO, filtering by trip_id there is hard without metadata.
  // However, we updated retrieval service to support trip_id in list_files_with_metadata.
  // Let's assume we use list_files_with_metadata if we need filtering, or the backend list_files was updated?
  // Wait, I only updated list_files_with_metadata.
  // The frontend uses listGpxFiles which calls /list-files.
  // I should probably switch this to use /list-files/detail if I want filtering, OR I should have updated /list-files.
  // But /list-files returns List[str], /list-files/detail returns List[FileListItem].
  // Let's use /list-files for now but pass the param, assuming I might update backend or it's fine.
  // Actually, for trip filtering to work for GPX, we MUST use metadata.
  // So I should probably change this to use /list-files/detail and map to filenames if needed, or just return the objects.
  // But to keep compatibility with existing frontend code that expects strings?
  // Existing frontend: setGpxFiles(files) where files is array of strings.
  // So I should probably update this to map the result of detail if tripId is present, or just return strings.
  // But wait, if I use /list-files, it ignores trip_id.
  // So I should use /list-files/detail and extract object_keys.

  // Let's change the endpoint to /list-files/detail and map to object_keys
  const response = await apiClient.get('/list-files/detail', { params: { bucket: 'gps-data', ...params } });
  return response.data.map(item => item.object_key);
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

export const listImageFiles = async (tripId = null) => {
  const params = { bucket: 'images' };
  if (tripId) {
    params.trip_id = tripId;
  }
  const response = await apiClient.get('/list-files/detail', {
    params: params
  });
  return response.data;
};

export const getGeotaggedImages = async (minLon, minLat, maxLon, maxLat, bucket = 'images', tripId = null) => {
  const params = { bucket };
  if (minLon !== undefined && minLat !== undefined && maxLon !== undefined && maxLat !== undefined) {
    params.minLon = minLon;
    params.minLat = minLat;
    params.maxLon = maxLon;
    params.maxLat = maxLat;
  }
  if (tripId) {
    params.trip_id = tripId;
  }
  const response = await apiClient.get('/images/geo', { params });
  return response.data;
};

export const getImageUrl = (filename) => {
  return `${apiClient.defaults.baseURL}/files/${encodeURIComponent(filename)}?bucket=images`;
};

export default apiClient;