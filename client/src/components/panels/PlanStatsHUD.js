// client/src/components/panels/PlanStatsHUD.js
import React, { useMemo } from 'react';
import { FEATURE_CATEGORY, ROUTE_TYPE, SEMANTIC_TYPE } from '../../services/planService';
import './PlanStatsHUD.css';

const toRadians = (deg) => (deg * Math.PI) / 180;
const EARTH_RADIUS_KM = 6371;

const segmentDistanceKm = (a, b, isLatLng = false) => {
  if (!a || !b || a.length < 2 || b.length < 2) return 0;
  const [lon1, lat1] = isLatLng ? [a[1], a[0]] : a;
  const [lon2, lat2] = isLatLng ? [b[1], b[0]] : b;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const originLat = toRadians(lat1);
  const destLat = toRadians(lat2);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(originLat) * Math.cos(destLat) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

const distanceForLineString = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    total += segmentDistanceKm(coordinates[i], coordinates[i + 1]);
  }
  return total;
};

const distanceForLatLngLineString = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    total += segmentDistanceKm(coordinates[i], coordinates[i + 1], true);
  }
  return total;
};

const PlanStatsHUD = ({ features = [], referenceTracks = [], trackData = {} }) => {
  const stats = useMemo(() => {
    const featuresArray = Array.isArray(features) ? features : features?.features || [];

    const checkpoints = featuresArray.filter(
      (f) => f.properties?.category === FEATURE_CATEGORY.WAYPOINT || f.properties?.category === 'waypoint'
    );
    const hazards = featuresArray.filter((f) => f.properties?.semantic_type === SEMANTIC_TYPE.HAZARD);
    const waterSources = featuresArray.filter((f) => f.properties?.semantic_type === SEMANTIC_TYPE.WATER);
    const camps = featuresArray.filter((f) => f.properties?.semantic_type === SEMANTIC_TYPE.CAMP);
    const escapeRoutes = featuresArray.filter((f) => f.properties?.route_type === ROUTE_TYPE.ESCAPE);

    const routeDistanceKm = featuresArray.reduce((total, feature) => {
      if (feature.geometry?.type !== 'LineString') return total;
      return total + distanceForLineString(feature.geometry.coordinates);
    }, 0);

    const referenceDistanceKm = referenceTracks.reduce((total, track) => {
      const data = trackData[track.object_key];
      if (!data || !Array.isArray(data.coordinates)) return total;
      // Reference coordinates are [lat, lon]
      return total + distanceForLatLngLineString(data.coordinates);
    }, 0);

    return {
      totalDistanceKm: routeDistanceKm,
      referenceDistanceKm,
      checkpointCount: checkpoints.length,
      hazardCount: hazards.length,
      waterCount: waterSources.length,
      campCount: camps.length,
      escapeCount: escapeRoutes.length,
    };
  }, [features, referenceTracks, trackData]);

  const cards = [
    {
      label: 'Planned Distance',
      value: `${stats.totalDistanceKm.toFixed(1)} km`,
      meta: 'Routes',
    },
    {
      label: 'Reference Distance',
      value: `${stats.referenceDistanceKm.toFixed(1)} km`,
      meta: 'Baseline GPX',
    },
    {
      label: 'Checkpoints',
      value: stats.checkpointCount,
      meta: 'Waypoints with time',
    },
    {
      label: 'Water Sources',
      value: stats.waterCount,
      meta: 'Semantic tag: Water',
    },
    {
      label: 'Camps',
      value: stats.campCount,
      meta: 'Semantic tag: Camp',
    },
    {
      label: 'Hazards',
      value: stats.hazardCount,
      meta: 'Semantic tag: Hazard',
    },
    {
      label: 'Escape Routes',
      value: stats.escapeCount,
      meta: 'Route type: Escape',
    },
  ];

  return (
    <div className="plan-stats-hud">
      <div className="hud-grid">
        {cards.map((card) => (
          <div key={card.label} className="hud-card">
            <p className="hud-label">{card.label}</p>
            <p className="hud-value">{card.value}</p>
            <span className="hud-meta">{card.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanStatsHUD;
