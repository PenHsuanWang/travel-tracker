// client/src/services/planService.js
/**
 * API service for Plan operations.
 * 
 * This module provides functions to interact with the Plan endpoints
 * of the backend API. It follows the same patterns as api.js for trips.
 */

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

// =============================================================================
// Plan CRUD Operations
// =============================================================================

/**
 * Create a new plan.
 * @param {Object} planData - Plan data { name, description, region, planned_start_date, planned_end_date, is_public }
 * @returns {Promise<Object>} Created plan
 */
export const createPlan = async (planData) => {
  const response = await apiClient.post('/plans/', planData);
  return response.data;
};

/**
 * Get all plans, optionally filtered by user_id or status.
 * @param {Object} params - Query parameters { user_id, status }
 * @returns {Promise<Array>} List of plans
 */
export const getPlans = async (params = {}) => {
  const response = await apiClient.get('/plans/', { params });
  return response.data;
};

/**
 * Get a single plan by ID.
 * @param {string} planId - Plan identifier
 * @returns {Promise<Object>} Plan details
 */
export const getPlan = async (planId) => {
  const response = await apiClient.get(`/plans/${planId}`);
  return response.data;
};

/**
 * Update a plan's metadata.
 * @param {string} planId - Plan identifier
 * @param {Object} planData - Fields to update
 * @returns {Promise<Object>} Updated plan
 */
export const updatePlan = async (planId, planData) => {
  const response = await apiClient.put(`/plans/${planId}`, planData);
  return response.data;
};

/**
 * Delete a plan.
 * @param {string} planId - Plan identifier
 * @returns {Promise<void>}
 */
export const deletePlan = async (planId) => {
  await apiClient.delete(`/plans/${planId}`);
};

/**
 * Update plan members.
 * @param {string} planId - Plan identifier
 * @param {Array<string>} memberIds - New list of member IDs
 * @returns {Promise<Object>} Updated plan
 */
export const updatePlanMembers = async (planId, memberIds) => {
  const response = await apiClient.put(`/plans/${planId}/members`, { member_ids: memberIds });
  return response.data;
};

// =============================================================================
// Feature Operations
// =============================================================================

/**
 * Add a feature (marker, polyline, polygon) to a plan.
 * @param {string} planId - Plan identifier
 * @param {Object} geometry - GeoJSON geometry { type, coordinates }
 * @param {Object} properties - Feature properties { name, description, icon_type, color, ... }
 * @returns {Promise<Object>} Created feature
 */
export const addFeature = async (planId, geometry, properties = {}) => {
  const response = await apiClient.post(`/plans/${planId}/features`, {
    geometry,
    properties,
  });
  return response.data;
};

/**
 * Update a feature's geometry or properties.
 * @param {string} planId - Plan identifier
 * @param {string} featureId - Feature identifier
 * @param {Object} updates - { geometry, properties }
 * @returns {Promise<Object>} Updated feature
 */
export const updateFeature = async (planId, featureId, updates) => {
  const response = await apiClient.put(`/plans/${planId}/features/${featureId}`, updates);
  return response.data;
};

/**
 * Delete a feature from a plan.
 * @param {string} planId - Plan identifier
 * @param {string} featureId - Feature identifier
 * @returns {Promise<void>}
 */
export const deleteFeature = async (planId, featureId) => {
  await apiClient.delete(`/plans/${planId}/features/${featureId}`);
};

/**
 * Batch update feature order_index values.
 * @param {string} planId - Plan identifier
 * @param {Array<Object>} featureOrders - List of { feature_id, order_index }
 * @returns {Promise<Object>} Success response
 */
export const reorderFeatures = async (planId, featureOrders) => {
  const response = await apiClient.put(`/plans/${planId}/features/reorder`, {
    feature_orders: featureOrders,
  });
  return response.data;
};

// =============================================================================
// Logistics & Roster Operations (Phase 2)
// =============================================================================

/**
 * Update plan logistics, roster, and gear checklist.
 * @param {string} planId - Plan identifier
 * @param {Object} logisticsData - { roster, logistics, checklist }
 * @param {Array<Object>} logisticsData.roster - Team members list
 * @param {Object} logisticsData.logistics - Logistics info (emergency_contacts, transportation_notes, permits, etc.)
 * @param {Array<Object>} logisticsData.checklist - Gear checklist items
 * @returns {Promise<Object>} Updated plan
 */
export const updateLogistics = async (planId, logisticsData) => {
  const response = await apiClient.put(`/plans/${planId}/logistics`, logisticsData);
  return response.data;
};

/**
 * Update plan day summaries (itinerary structure).
 * @param {string} planId - Plan identifier
 * @param {Array<Object>} daySummaries - Day summary objects with day_number, date, title, notes, etc.
 * @returns {Promise<Object>} Updated plan
 */
export const updateDaySummaries = async (planId, daySummaries) => {
  const response = await apiClient.put(`/plans/${planId}/days`, {
    day_summaries: daySummaries,
  });
  return response.data;
};

// =============================================================================
// Reference Track Operations
// =============================================================================

/**
 * Add a reference GPX track to a plan.
 * @param {string} planId - Plan identifier
 * @param {Object} trackData - { object_key, filename, display_name, color, opacity }
 * @returns {Promise<Object>} Created reference track
 */
export const addReferenceTrack = async (planId, trackData) => {
  const response = await apiClient.post(`/plans/${planId}/reference-tracks`, trackData);
  return response.data;
};

/**
 * Upload a GPX file and add it as a reference track to a plan.
 * @param {string} planId - Plan identifier
 * @param {File} file - GPX file to upload
 * @param {Object} options - Optional settings { display_name, color, opacity }
 * @returns {Promise<Object>} Created reference track
 */
export const uploadReferenceTrack = async (planId, file, options = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  if (options.display_name) {
    formData.append('display_name', options.display_name);
  }
  if (options.color) {
    formData.append('color', options.color);
  }
  if (options.opacity !== undefined) {
    formData.append('opacity', String(options.opacity));
  }
  
  const response = await apiClient.post(`/plans/${planId}/reference-tracks/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Remove a reference track from a plan.
 * @param {string} planId - Plan identifier
 * @param {string} trackId - Reference track identifier
 * @returns {Promise<void>}
 */
export const removeReferenceTrack = async (planId, trackId) => {
  await apiClient.delete(`/plans/${planId}/reference-tracks/${trackId}`);
};

// =============================================================================
// GPX Ingestion Operations
// =============================================================================

/**
 * Upload and analyze a GPX file for import preview.
 * Returns detected waypoints and track info without creating a plan.
 * @param {File} file - GPX file to analyze
 * @returns {Promise<Object>} GpxIngestionPreview { detected_waypoints, track_geometry, gpx_start_time, gpx_end_time, temp_file_key }
 */
export const ingestGpx = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/plans/ingest-gpx', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Create a plan with GPX data, specifying the import strategy.
 * @param {Object} planData - Plan data { name, description, region, planned_start_date, planned_end_date, is_public }
 * @param {Object} gpxStrategy - GPX import strategy { temp_file_key, mode, selected_waypoint_indices }
 * @returns {Promise<Object>} Created plan with features
 */
export const createPlanWithGpx = async (planData, gpxStrategy) => {
  const response = await apiClient.post('/plans/', {
    ...planData,
    gpx_strategy: gpxStrategy,
  });
  return response.data;
};

/**
 * Clone an existing trip to a new plan.
 * @param {string} tripId - Source trip identifier
 * @param {Object} options - { name, planned_start_date, strategy }
 *   - name: Plan name (defaults to "[Trip Name] Plan")
 *   - planned_start_date: New start date for time projection
 *   - strategy: 'relative' | 'absolute' | 'no_times'
 * @returns {Promise<Object>} Created plan
 */
export const importTripToPlan = async (tripId, options = {}) => {
  const response = await apiClient.post(`/plans/import-trip/${tripId}`, options);
  return response.data;
};

/**
 * Update a feature with optional cascade time propagation.
 * When cascade is true and time is modified, updates all subsequent features.
 * @param {string} planId - Plan identifier
 * @param {string} featureId - Feature identifier
 * @param {Object} updates - { geometry, properties }
 * @param {boolean} cascadeTime - Whether to propagate time changes
 * @returns {Promise<Object>} Updated plan (with all features)
 */
export const updateFeatureWithCascade = async (planId, featureId, updates, cascadeTime = false) => {
  const response = await apiClient.put(`/plans/${planId}/features/${featureId}/cascade`, {
    ...updates,
    cascade_time: cascadeTime,
  });
  return response.data;
};

/**
 * GPX ingestion strategy types.
 */
export const GPX_INGESTION_STRATEGY = {
  RELATIVE: 'relative',   // Calculate time offsets from GPX start
  ABSOLUTE: 'absolute',   // Use exact GPX timestamps
  NO_TIMES: 'no_times',   // Import without time data
};

export const GPX_STRATEGY_LABELS = {
  relative: 'Relative Time (Recommended)',
  absolute: 'Absolute Time',
  no_times: 'No Time Data',
};

export const GPX_STRATEGY_DESCRIPTIONS = {
  relative: 'Waypoint times are calculated relative to your planned start date',
  absolute: 'Use exact timestamps from the GPX file',
  no_times: 'Import waypoints without time information',
};

// =============================================================================
// Marker Icon Types (for UI dropdowns)
// =============================================================================

export const MARKER_ICON_TYPES = [
  { value: 'camp', label: '⛺ Campsite', emoji: '⛺' },
  { value: 'water', label: '💧 Water Source', emoji: '💧' },
  { value: 'danger', label: '⚠️ Hazard', emoji: '⚠️' },
  { value: 'viewpoint', label: '👁️ Viewpoint', emoji: '👁️' },
  { value: 'trailhead', label: '🚶 Trailhead', emoji: '🚶' },
  { value: 'parking', label: '🅿️ Parking', emoji: '🅿️' },
  { value: 'hut', label: '🏠 Shelter/Hut', emoji: '🏠' },
  { value: 'summit', label: '⛰️ Summit', emoji: '⛰️' },
  { value: 'food', label: '🍴 Food', emoji: '🍴' },
  { value: 'lodging', label: '🏨 Lodging', emoji: '🏨' },
  { value: 'info', label: 'ℹ️ Information', emoji: 'ℹ️' },
  { value: 'custom', label: '📍 Custom', emoji: '📍' },
];

/**
 * Get emoji for a marker icon type.
 * @param {string} iconType - Marker icon type value
 * @returns {string} Emoji character
 */
export const getMarkerEmoji = (iconType) => {
  const found = MARKER_ICON_TYPES.find((t) => t.value === iconType);
  return found ? found.emoji : '📍';
};

// =============================================================================
// Plan Status Types
// =============================================================================

export const PLAN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
};

export const PLAN_STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

// =============================================================================
// Semantic Types (Phase 2 Module A)
// =============================================================================

export const SEMANTIC_TYPE = {
  WATER: 'water',
  CAMP: 'camp',
  SIGNAL: 'signal',
  HAZARD: 'hazard',
  CHECKIN: 'checkin',
  GENERIC: 'generic',
};

export const SEMANTIC_TYPE_LABELS = {
  water: 'Water',
  camp: 'Camp',
  signal: 'Signal',
  hazard: 'Hazard',
  checkin: 'Check-in',
  generic: 'Generic',
};

// Route types for line features
export const ROUTE_TYPE = {
  MAIN: 'main',
  ESCAPE: 'escape',
};

// =============================================================================
// Feature Category Types
// =============================================================================

/**
 * Feature categories determine behavior and allowed properties.
 * - WAYPOINT: Time-enabled point (displays as "Checkpoint" in UI)
 * - MARKER: Static POI point (no time fields)
 * - ROUTE: LineString path
 * - AREA: Polygon region
 */
export const FEATURE_CATEGORY = {
  WAYPOINT: 'waypoint',
  MARKER: 'marker',
  ROUTE: 'route',
  AREA: 'area',
  REFERENCE_TRACK: 'reference_track',
};

export const FEATURE_CATEGORY_LABELS = {
  waypoint: 'Checkpoint',  // UI name for waypoint
  marker: 'Marker',
  route: 'Route',
  area: 'Area',
  reference_track: 'Reference Track',
};

export const FEATURE_CATEGORY_ICONS = {
  waypoint: '📍',
  marker: '📌',
  route: '〰️',
  area: '⬡',
  reference_track: '🗺️',
};

/**
 * Get the display label for a feature category.
 * @param {string} category - Feature category value
 * @returns {string} Display label
 */
export const getCategoryLabel = (category) => {
  return FEATURE_CATEGORY_LABELS[category] || category;
};

/**
 * Get the icon for a feature category.
 * @param {string} category - Feature category value
 * @returns {string} Emoji icon
 */
export const getCategoryIcon = (category) => {
  return FEATURE_CATEGORY_ICONS[category] || '•';
};

/**
 * Check if a feature category allows time fields.
 * Only WAYPOINT category supports estimated_arrival and estimated_duration_minutes.
 * @param {string} category - Feature category value
 * @returns {boolean}
 */
export const categoryAllowsTime = (category) => {
  return category === FEATURE_CATEGORY.WAYPOINT;
};

/**
 * Get the default category for a geometry type.
 * @param {string} geometryType - GeoJSON geometry type
 * @returns {string} Feature category
 */
export const getDefaultCategoryForGeometry = (geometryType) => {
  switch (geometryType) {
    case 'Point':
      return FEATURE_CATEGORY.MARKER;
    case 'LineString':
      return FEATURE_CATEGORY.ROUTE;
    case 'Polygon':
      return FEATURE_CATEGORY.AREA;
    default:
      return FEATURE_CATEGORY.MARKER;
  }
};

/**
 * Format coordinates for display.
 * @param {Array} coordinates - [lon, lat] array
 * @param {number} precision - Decimal places (default 4)
 * @returns {string} Formatted string "lat, lon"
 */
export const formatCoordinates = (coordinates, precision = 4) => {
  if (!coordinates || coordinates.length < 2) return '';
  const [lon, lat] = coordinates;
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
};

/**
 * Format datetime for display.
 * @param {string|Date} datetime - ISO datetime string or Date object
 * @returns {string} Formatted string like "Jan 15, 10:30 AM"
 */
export const formatArrivalTime = (datetime) => {
  if (!datetime) return 'No time set';
  try {
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Invalid time';
  }
};

/**
 * Format duration in minutes for display.
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted string like "30 min stop"
 */
export const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return null;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins > 0) {
      return `${hours}h ${mins}m stop`;
    }
    return `${hours}h stop`;
  }
  return `${minutes} min stop`;
};

export default apiClient;
