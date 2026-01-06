/**
 * Geometric utility functions for map features.
 */

// Earth radius in meters
const R = 6371000;

/**
 * Calculate distance between two points in meters using Haversine formula.
 * @param {Array} pt1 - [lat, lon]
 * @param {Array} pt2 - [lat, lon]
 * @returns {number} Distance in meters
 */
export const getDistanceMeters = (pt1, pt2) => {
  const lat1 = (pt1[0] * Math.PI) / 180;
  const lat2 = (pt2[0] * Math.PI) / 180;
  const dLat = ((pt2[0] - pt1[0]) * Math.PI) / 180;
  const dLon = ((pt2[1] - pt1[1]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calculate length of a LineString in kilometers.
 * @param {Object} geometry - GeoJSON LineString geometry
 * @returns {number} Length in km
 */
export const calculateLengthKm = (geometry) => {
  if (geometry?.type !== 'LineString' || !geometry.coordinates) return 0;
  
  let totalMeters = 0;
  const coords = geometry.coordinates; // [lon, lat]
  
  for (let i = 0; i < coords.length - 1; i++) {
    // GeoJSON is [lon, lat], getDistance expects [lat, lon]
    const p1 = [coords[i][1], coords[i][0]];
    const p2 = [coords[i+1][1], coords[i+1][0]];
    totalMeters += getDistanceMeters(p1, p2);
  }
  
  return totalMeters / 1000;
};

/**
 * Calculate area of a Polygon in square meters using Shoelace formula on spherical projection (simplified).
 * For small areas (hiking zones), planar projection approximation is acceptable usually,
 * but using a geodesic area is better.
 * We'll implementation a simple spherical polygon area or use a library if we had one.
 * Given dependencies, we'll use a spherical excess formula or simple projection for small areas.
 * 
 * Simple implementation: Project to meters (Web Mercator-ish scale factor) and calc area.
 * Better: Use standard spherical area formula.
 * @param {Object} geometry - GeoJSON Polygon geometry
 * @returns {number} Area in square meters
 */
export const calculateAreaSqM = (geometry) => {
  if (geometry?.type !== 'Polygon' || !geometry.coordinates || !geometry.coordinates[0]) return 0;
  
  const ring = geometry.coordinates[0]; // Outer ring [lon, lat]
  if (ring.length < 3) return 0;

  let area = 0;
  
  if (ring.length > 2) {
      for (let i = 0; i < ring.length - 1; i++) {
          const p1 = ring[i];
          const p2 = ring[i + 1];
          // Convert to radians
          const p1Lon = (p1[0] * Math.PI) / 180;
          const p1Lat = (p1[1] * Math.PI) / 180;
          const p2Lon = (p2[0] * Math.PI) / 180;
          const p2Lat = (p2[1] * Math.PI) / 180;
          
          area += (p2Lon - p1Lon) * (2 + Math.sin(p1Lat) + Math.sin(p2Lat));
      }
      area = area * R * R / 2;
  }
  
  return Math.abs(area);
};

/**
 * Format area for display.
 * @param {number} sqMeters 
 * @returns {string} e.g. "1200 m²" or "1.5 ha"
 */
export const formatArea = (sqMeters) => {
  if (!sqMeters) return '';
  if (sqMeters >= 10000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  }
  return `${Math.round(sqMeters).toLocaleString()} m²`;
};
