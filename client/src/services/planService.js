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
 * Remove a reference track from a plan.
 * @param {string} planId - Plan identifier
 * @param {string} trackId - Reference track identifier
 * @returns {Promise<void>}
 */
export const removeReferenceTrack = async (planId, trackId) => {
  await apiClient.delete(`/plans/${planId}/reference-tracks/${trackId}`);
};

// =============================================================================
// Plan Promotion
// =============================================================================

/**
 * Promote a plan to a trip.
 * @param {string} planId - Plan identifier
 * @param {Object} options - { copy_reference_tracks, include_planned_route_as_ghost }
 * @returns {Promise<Object>} { plan_id, trip_id, reference_tracks_copied, ghost_layer_created }
 */
export const promotePlanToTrip = async (planId, options = {}) => {
  const response = await apiClient.post(`/plans/${planId}/promote`, {
    copy_reference_tracks: options.copyReferenceTracks ?? true,
    include_planned_route_as_ghost: options.includeGhostLayer ?? true,
  });
  return response.data;
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
  PROMOTED: 'promoted',
  ARCHIVED: 'archived',
};

export const PLAN_STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  promoted: 'Promoted',
  archived: 'Archived',
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
