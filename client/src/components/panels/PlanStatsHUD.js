// client/src/components/panels/PlanStatsHUD.js
import React, { useMemo, useState } from 'react';
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

const PlanStatsHUD = ({ 
  features = [], 
  referenceTracks = [], 
  trackData = {},
  onSelectFeature,
  onFlyToFeature,
  onFlyToTrack
}) => {
  const [activeCard, setActiveCard] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const stats = useMemo(() => {
    const featuresArray = Array.isArray(features) ? features : features?.features || [];

    const checkpoints = featuresArray.filter(
      (f) => f.properties?.category === FEATURE_CATEGORY.WAYPOINT || f.properties?.category === 'waypoint'
    );
    const hazards = featuresArray.filter((f) => f.properties?.semantic_type === SEMANTIC_TYPE.HAZARD);
    const waterSources = featuresArray.filter((f) => f.properties?.semantic_type === SEMANTIC_TYPE.WATER);
    const camps = featuresArray.filter((f) => f.properties?.semantic_type === SEMANTIC_TYPE.CAMP);
    const escapeRoutes = featuresArray.filter((f) => f.properties?.route_type === ROUTE_TYPE.ESCAPE);
    const routes = featuresArray.filter((f) => f.geometry?.type === 'LineString' && f.properties?.route_type !== ROUTE_TYPE.ESCAPE);

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
      // Lists for interaction
      routesList: routes,
      checkpointsList: checkpoints,
      hazardsList: hazards,
      waterList: waterSources,
      campsList: camps,
      escapeList: escapeRoutes,
      referenceList: referenceTracks,
    };
  }, [features, referenceTracks, trackData]);

  const toggleCard = (key) => {
    if (activeCard === key) {
      setActiveCard(null);
    } else {
      setActiveCard(key);
    }
  };

  const handleFeatureClick = (e, featureId) => {
    e.stopPropagation();
    if (onSelectFeature) onSelectFeature(featureId);
    if (onFlyToFeature) onFlyToFeature(featureId);
    setActiveCard(null); // Close after selection
  };

  const handleTrackClick = (e, trackId) => {
    e.stopPropagation();
    if (onFlyToTrack) onFlyToTrack(trackId);
    setActiveCard(null);
  };

  const cards = [
    {
      key: 'distance',
      label: 'Planned Distance',
      value: `${stats.totalDistanceKm.toFixed(1)} km`,
      meta: 'Routes',
      items: stats.routesList,
      type: 'feature'
    },
    {
      key: 'reference',
      label: 'Reference Distance',
      value: `${stats.referenceDistanceKm.toFixed(1)} km`,
      meta: 'Baseline GPX',
      items: stats.referenceList,
      type: 'track'
    },
    {
      key: 'checkpoints',
      label: 'Checkpoints',
      value: stats.checkpointCount,
      meta: 'Waypoints with time',
      items: stats.checkpointsList,
      type: 'feature'
    },
    {
      key: 'water',
      label: 'Water Sources',
      value: stats.waterCount,
      meta: 'Semantic tag: Water',
      items: stats.waterList,
      type: 'feature'
    },
    {
      key: 'camps',
      label: 'Camps',
      value: stats.campCount,
      meta: 'Semantic tag: Camp',
      items: stats.campsList,
      type: 'feature'
    },
    {
      key: 'hazards',
      label: 'Hazards',
      value: stats.hazardCount,
      meta: 'Semantic tag: Hazard',
      items: stats.hazardsList,
      type: 'feature'
    },
    {
      key: 'escape',
      label: 'Escape Routes',
      value: stats.escapeCount,
      meta: 'Route type: Escape',
      items: stats.escapeList,
      type: 'feature'
    },
  ];

  return (
    <div className={`plan-stats-hud ${isCollapsed ? 'is-collapsed' : ''}`}>
      <div 
        className="hud-toggle-header" 
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="hud-header-title">
          <span className="hud-header-text">TRIP STATISTICS</span>
          {isCollapsed && (
            <span className="hud-header-summary">
              {stats.totalDistanceKm.toFixed(1)} km • {stats.checkpointCount} Waypoints
            </span>
          )}
        </div>
        <button className="toggle-btn" title={isCollapsed ? "Show Stats" : "Hide Stats"}>
          <svg 
            viewBox="0 0 24 24" 
            width="16" 
            height="16" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      <div className="hud-content-wrapper">
        <div className="hud-grid">
          {cards.map((card) => {
            const hasItems = card.items && card.items.length > 0;
            return (
              <div 
                key={card.key} 
                className={`hud-card ${activeCard === card.key ? 'active' : ''} ${hasItems ? 'clickable' : ''}`}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent toggling HUD when clicking card
                  hasItems && toggleCard(card.key);
                }}
                role={hasItems ? "button" : "article"}
                tabIndex={hasItems ? 0 : undefined}
              >
                <p className="hud-label">{card.label}</p>
                <p className="hud-value">{card.value}</p>
                <span className="hud-meta">{card.meta}</span>
                
                {activeCard === card.key && hasItems && (
                  <div className="hud-dropdown">
                    <div className="hud-dropdown-header">
                      <span>{card.items.length} Items</span>
                      <button className="hud-dropdown-close" onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}>×</button>
                    </div>
                    <ul className="hud-dropdown-list">
                      {card.items.map((item, idx) => {
                        const name = item.properties?.name || item.display_name || item.filename || `Item ${idx + 1}`;
                        return (
                          <li 
                            key={item.id || idx} 
                            className="hud-dropdown-item"
                            onClick={(e) => card.type === 'track' ? handleTrackClick(e, item.id) : handleFeatureClick(e, item.id)}
                          >
                            {name}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlanStatsHUD;
