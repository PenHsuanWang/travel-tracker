// client/src/services/api.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Trip API ---

export const createTrip = async (tripData) => {
  const response = await apiClient.post('/trips/', tripData);
  return response.data;
};

export const createTripWithGpx = async (tripData, gpxFile) => {
  const formData = new FormData();
  formData.append('name', tripData.name);
  if (tripData.start_date) formData.append('start_date', tripData.start_date);
  if (tripData.end_date) formData.append('end_date', tripData.end_date);
  if (tripData.region) formData.append('region', tripData.region);
  if (tripData.notes) formData.append('notes', tripData.notes);
  if (gpxFile) formData.append('gpx_file', gpxFile);

  const response = await apiClient.post('/trips/with-gpx', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getTrips = async (params = {}) => {
  const response = await apiClient.get('/trips/', { params });
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

export const searchUsers = async (query) => {
  const response = await apiClient.get('/users/search', { params: { q: query } });
  return response.data;
};

export const updateTripMembers = async (tripId, memberIds) => {
  const response = await apiClient.put(`/trips/${tripId}/members`, { member_ids: memberIds });
  return response.data;
};

// --- File API ---

const resolveApiUrl = (pathOrUrl) => {
  if (!pathOrUrl) return '';
  // Already absolute
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  try {
    const base = apiClient.defaults.baseURL || (typeof window !== 'undefined' ? window.location.origin : '');
    return new URL(pathOrUrl, base).toString();
  } catch (err) {
    console.warn('[api] Failed to resolve API URL', { pathOrUrl, err });
    return pathOrUrl;
  }
};

export const updatePhotoNote = async (metadataId, { note, note_title }) => {
  const response = await apiClient.patch(`/photos/${encodeURIComponent(metadataId).replace(/%2F/g, '/')}/note`, {
    note,
    note_title,
  });
  return response.data;
};

export const updateWaypointNote = async (metadataId, waypointIndex, payload) => {
  if (!metadataId || waypointIndex === undefined) {
    throw new Error(`Invalid waypoint update parameters: metadataId="${metadataId}", waypointIndex="${waypointIndex}"`);
  }
  
  // Use encodeURIComponent for the entire metadata_id, FastAPI will handle :path correctly
  const encodedId = encodeURIComponent(metadataId);
  console.log('[API] updateWaypointNote:', { metadataId, encodedId, waypointIndex, payload });
  
  const response = await apiClient.patch(`/gpx/metadata/${encodedId}/waypoint/${waypointIndex}`, payload);
  return response.data;
};


export const updatePhotoOrder = async (metadataId, order_index) => {
  const response = await apiClient.patch(`/photos/${encodeURIComponent(metadataId).replace(/%2F/g, '/')}/order`, {
    order_index,
  });
  return response.data;
};

export const deleteFile = async (filename, bucket = 'images') => {
  const response = await apiClient.delete(`/map/delete/${encodeURIComponent(filename).replace(/%2F/g, '/')}`, {
    params: { bucket }
  });
  return response.data;
};

export const deleteGpxFile = async (filename) => deleteFile(filename, 'gps-data');

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
  const response = await apiClient.delete(`/map/delete/${encodeURIComponent(filename).replace(/%2F/g, '/')}`, {
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

export const listGpxFilesWithMeta = async (tripId = null) => {
  const params = { bucket: 'gps-data' };
  if (tripId) {
    params.trip_id = tripId;
  }
  const response = await apiClient.get('/list-files/detail', { params });
  return response.data;
};

export const fetchGpxFile = async (filename, bucket = 'gps-data') => {
  const response = await apiClient.get(`/files/${encodeURIComponent(filename).replace(/%2F/g, '/')}`, {
    params: { bucket },
    responseType: 'arraybuffer',
  });
  return response.data;
};

export const fetchGpxAnalysis = async (filename, tripId = null) => {
  const params = {};
  if (tripId) {
    params.trip_id = tripId;
  }
  const response = await apiClient.get(`/gpx/${encodeURIComponent(filename).replace(/%2F/g, '/')}/analysis`, { params });
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

export const getImageVariantUrl = (filename, variant = 'thumb') => {
  if (!filename) return '';
  // If the backend already returned a URL or path, resolve it instead of re-encoding.
  if (filename.startsWith('/')) {
    return resolveApiUrl(filename);
  }
  if (/^https?:\/\//i.test(filename)) {
    return filename;
  }
  const encoded = encodeURIComponent(filename).replace(/%2F/g, '/');
  const safeVariant = variant || 'original';
  return `${apiClient.defaults.baseURL}/files/${encoded}?bucket=images&variant=${safeVariant}`;
};

export const getImageUrl = (filename, variant = 'original') => getImageVariantUrl(filename, variant);

export const normalizeImageUrl = (value, variant = 'original') => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
    return resolveApiUrl(value);
  }
  return getImageVariantUrl(value, variant);
};

export default apiClient;
