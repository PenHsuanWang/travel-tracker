// client/src/components/views/PlanMapView.js
/**
 * PlanMapView - Map view for the plan canvas with drawing support.
 * 
 * Displays plan features (markers, polylines, polygons) and reference tracks.
 * When a drawing tool is active, clicking on the map creates that feature type.
 * Supports OpenTopoMap and other tile layers with a layer switcher.
 */
import React, { useEffect, useMemo, useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, Popup, Circle, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import FeatureStyleEditor from '../common/FeatureStyleEditor';
import 'leaflet/dist/leaflet.css';
import './PlanMapView.css';

// Available map layers
const MAP_LAYERS = {
  'rudy': {
    name: 'Rudy Map',
    url: 'https://tile.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png',
    attribution: 'Map data © Rudy contributors',
  },
  'happyman': {
    name: 'Happyman',
    url: 'https://tile.happyman.idv.tw/map/moi_osm/{z}/{x}/{y}.png',
    attribution: 'Map data © Happyman contributors',
  },
  'openstreetmap': {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
  'opentopomap': {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: © OpenStreetMap, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
  },
};

// Map layer controller
function MapLayerController({ selectedLayer }) {
  const map = useMap();

  useEffect(() => {
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const layerConfig = MAP_LAYERS[selectedLayer] || MAP_LAYERS['rudy'];
    L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: 17,
    }).addTo(map);
  }, [selectedLayer, map]);

  return null;
}

// Snap-to-Track helper (FR-051): Find closest point on reference tracks
const SNAP_TOLERANCE_PX = 20; // 20 pixel snap threshold per HLD

function findSnapPoint(map, clickLatLng, referenceTrackCoords) {
  if (!referenceTrackCoords || referenceTrackCoords.length === 0) {
    return null;
  }

  let closestPoint = null;
  let minDistance = Infinity;

  referenceTrackCoords.forEach((coordArray) => {
    if (!coordArray || coordArray.length < 2) return;

    // Find closest point on this polyline
    for (let i = 0; i < coordArray.length - 1; i++) {
      const segStart = L.latLng(coordArray[i]);
      const segEnd = L.latLng(coordArray[i + 1]);
      
      // Project click point onto segment
      const projected = projectPointOnSegment(clickLatLng, segStart, segEnd);
      const distancePx = map.latLngToContainerPoint(clickLatLng).distanceTo(
        map.latLngToContainerPoint(projected)
      );
      
      if (distancePx < minDistance) {
        minDistance = distancePx;
        closestPoint = projected;
      }
    }
  });

  // Only snap if within tolerance
  if (closestPoint && minDistance <= SNAP_TOLERANCE_PX) {
    return closestPoint;
  }
  return null;
}

// Project a point onto a line segment and return the closest point
function projectPointOnSegment(point, segStart, segEnd) {
  const startPt = L.latLng(segStart);
  const endPt = L.latLng(segEnd);
  const clickPt = L.latLng(point);

  // Vector from start to end
  const dx = endPt.lng - startPt.lng;
  const dy = endPt.lat - startPt.lat;
  
  // Length squared
  const lenSq = dx * dx + dy * dy;
  
  if (lenSq === 0) {
    // Segment is a point
    return startPt;
  }
  
  // Project point onto line (parametric)
  const t = Math.max(0, Math.min(1, (
    (clickPt.lng - startPt.lng) * dx + (clickPt.lat - startPt.lat) * dy
  ) / lenSq));
  
  return L.latLng(
    startPt.lat + t * dy,
    startPt.lng + t * dx
  );
}

// Drawing controller - handles map clicks when a tool is active
function DrawingController({ 
  activeTool, 
  activeDrawCategory,
  onAddFeature,
  drawingState,
  setDrawingState,
  referenceTrackCoords,
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      if (!activeTool) return;

      let { lat, lng } = e.latlng;

      // FR-051: Snap to reference track for marker/waypoint tools
      if (activeTool === 'marker' || activeTool === 'waypoint') {
        const snapPoint = findSnapPoint(map, e.latlng, referenceTrackCoords);
        if (snapPoint) {
          lat = snapPoint.lat;
          lng = snapPoint.lng;
          console.log('[Snap-to-Track] Snapped to reference track:', { lat, lng });
        }
        
        // Create a point feature immediately
        // Use the activeDrawCategory if provided, otherwise infer from tool
        const category = activeDrawCategory || (activeTool === 'waypoint' ? 'waypoint' : 'marker');
        const geometry = {
          type: 'Point',
          coordinates: [lng, lat], // GeoJSON uses [lng, lat]
        };
        const properties = {
          category,
          icon_type: 'custom',
          name: null,
        };
        onAddFeature(geometry, properties);
        return;
      }

      if (activeTool === 'polyline' || activeTool === 'polygon') {
        // Add vertex to current drawing
        setDrawingState(prev => ({
          ...prev,
          isDrawing: true,
          vertices: [...(prev.vertices || []), [lat, lng]],
        }));
        return;
      }

      if (activeTool === 'rectangle') {
        if (!drawingState.isDrawing) {
          // First click - start rectangle
          setDrawingState({
            isDrawing: true,
            startPoint: [lat, lng],
            currentPoint: [lat, lng],
            vertices: [],
          });
        } else {
          // Second click - finish rectangle
          const bounds = [drawingState.startPoint, [lat, lng]];
          const geometry = {
            type: 'Polygon',
            coordinates: [[
              [bounds[0][1], bounds[0][0]], // SW
              [bounds[1][1], bounds[0][0]], // NW
              [bounds[1][1], bounds[1][0]], // NE
              [bounds[0][1], bounds[1][0]], // SE
              [bounds[0][1], bounds[0][0]], // close
            ]],
          };
          onAddFeature(geometry, { 
            category: activeDrawCategory || 'area',
            shape_type: 'rectangle' 
          });
          setDrawingState({ isDrawing: false, vertices: [], startPoint: null, currentPoint: null });
        }
        return;
      }

      if (activeTool === 'circle') {
        if (!drawingState.isDrawing) {
          // First click - set center
          setDrawingState({
            isDrawing: true,
            center: [lat, lng],
            radius: 0,
            vertices: [],
          });
        } else {
          // Second click - finish circle (convert to polygon approximation)
          const center = drawingState.center;
          const radius = map.distance(center, [lat, lng]);
          const numPoints = 32;
          const coords = [];
          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const point = L.latLng(center).toBounds(radius * 2).getCenter();
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);
            const lat2 = center[0] + (dy / 111320);
            const lng2 = center[1] + (dx / (111320 * Math.cos(center[0] * Math.PI / 180)));
            coords.push([lng2, lat2]);
          }
          const geometry = {
            type: 'Polygon',
            coordinates: [coords],
          };
          onAddFeature(geometry, { 
            category: activeDrawCategory || 'area',
            shape_type: 'circle', 
            center: [center[1], center[0]], 
            radius 
          });
          setDrawingState({ isDrawing: false, vertices: [], center: null, radius: 0 });
        }
        return;
      }
    },
    mousemove(e) {
      if (!activeTool || !drawingState.isDrawing) return;
      
      const { lat, lng } = e.latlng;

      if (activeTool === 'rectangle' && drawingState.startPoint) {
        setDrawingState(prev => ({
          ...prev,
          currentPoint: [lat, lng],
        }));
      }

      if (activeTool === 'circle' && drawingState.center) {
        const radius = map.distance(drawingState.center, [lat, lng]);
        setDrawingState(prev => ({
          ...prev,
          radius,
          currentPoint: [lat, lng],
        }));
      }

      if ((activeTool === 'polyline' || activeTool === 'polygon') && drawingState.vertices?.length > 0) {
        setDrawingState(prev => ({
          ...prev,
          currentPoint: [lat, lng],
        }));
      }
    },
  });

  // Change cursor based on active tool
  useEffect(() => {
    const container = map.getContainer();
    if (activeTool) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
    return () => {
      container.style.cursor = '';
    };
  }, [activeTool, map]);

  return null;
}

// Drawing preview component - shows shape being drawn
function DrawingPreview({ activeTool, drawingState }) {
  if (!activeTool || !drawingState.isDrawing) return null;

  const { vertices, startPoint, currentPoint, center, radius } = drawingState;

  // Polyline/Polygon preview
  if ((activeTool === 'polyline' || activeTool === 'polygon') && vertices && vertices.length > 0) {
    const previewPositions = currentPoint ? [...vertices, currentPoint] : vertices;
    
    // Draw vertices as small circles
    const vertexMarkers = vertices.map((pos, idx) => (
      <Circle
        key={`vertex-${idx}`}
        center={pos}
        radius={6}
        pathOptions={{
          color: '#fff',
          fillColor: idx === 0 ? '#fff' : '#3388ff',
          fillOpacity: 1,
          weight: 2,
        }}
      />
    ));

    return (
      <>
        {activeTool === 'polygon' && vertices.length >= 2 ? (
          <Polygon
            positions={previewPositions}
            pathOptions={{
              color: '#3388ff',
              weight: 2,
              dashArray: '5, 10',
              fillOpacity: 0.1,
            }}
          />
        ) : (
          <Polyline
            positions={previewPositions}
            pathOptions={{
              color: '#3388ff',
              weight: 2,
              dashArray: '5, 10',
            }}
          />
        )}
        {vertexMarkers}
      </>
    );
  }

  // Rectangle preview
  if (activeTool === 'rectangle' && startPoint && currentPoint) {
    const bounds = [startPoint, currentPoint];
    return (
      <>
        <Rectangle
          bounds={bounds}
          pathOptions={{
            color: '#3388ff',
            weight: 2,
            dashArray: '5, 10',
            fillOpacity: 0.1,
          }}
        />
        <Circle
          center={startPoint}
          radius={6}
          pathOptions={{ color: '#fff', fillColor: '#3388ff', fillOpacity: 1, weight: 2 }}
        />
        <Circle
          center={currentPoint}
          radius={6}
          pathOptions={{ color: '#fff', fillColor: '#3388ff', fillOpacity: 1, weight: 2 }}
        />
      </>
    );
  }

  // Circle preview
  if (activeTool === 'circle' && center && radius > 0) {
    return (
      <>
        <Circle
          center={center}
          radius={radius}
          pathOptions={{
            color: '#3388ff',
            weight: 2,
            dashArray: '5, 10',
            fillOpacity: 0.1,
          }}
        />
        <Circle
          center={center}
          radius={6}
          pathOptions={{ color: '#fff', fillColor: '#3388ff', fillOpacity: 1, weight: 2 }}
        />
        {currentPoint && (
          <Polyline
            positions={[center, currentPoint]}
            pathOptions={{ color: '#3388ff', weight: 1, dashArray: '3, 6' }}
          />
        )}
      </>
    );
  }

  return null;
}

// Feature bounds controller - fits map to features
function FeatureBoundsController({ features, referenceTracks, trackData }) {
  const map = useMap();

  useEffect(() => {
    const points = [];

    // Ensure features is an array
    const featuresArray = Array.isArray(features) ? features : (features?.features || []);

    // Collect points from features
    featuresArray.forEach((feature) => {
      const geom = feature.geometry;
      if (geom?.type === 'Point' && geom.coordinates) {
        points.push([geom.coordinates[1], geom.coordinates[0]]);
      } else if (geom?.type === 'LineString' && geom.coordinates) {
        geom.coordinates.forEach((coord) => {
          points.push([coord[1], coord[0]]);
        });
      } else if (geom?.type === 'Polygon' && geom.coordinates?.[0]) {
        geom.coordinates[0].forEach((coord) => {
          points.push([coord[1], coord[0]]);
        });
      }
    });

    // Collect points from reference tracks
    if (referenceTracks && trackData) {
      referenceTracks.forEach(track => {
        const data = trackData[track.object_key];
        if (data && data.coordinates) {
          data.coordinates.forEach(coord => {
            // Check coordinate format (lat, lon) vs (lon, lat)
            // fetchGpxAnalysis returns [lat, lon] usually for coordinates?
            // Let's check GpxAnalysisResponse in backend.
            // Backend extract_coordinates returns [lat, lon].
            // So we can push directly.
            points.push(coord);
          });
        }
      });
    }

    if (points.length > 0) {
      try {
        const bounds = L.latLngBounds(points);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }
      } catch (e) {
        console.error('Error fitting bounds:', e);
      }
    }
  }, [features, referenceTracks, trackData, map]);

  return null;
}

// Create blue teardrop marker icons - with memoization for performance
const createMarkerIconHtml = (size, color, strokeColor, classes) => `
  <svg viewBox="0 0 24 36" width="${size * 0.7}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" 
          fill="${color}" stroke="${strokeColor}" stroke-width="1"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/>
  </svg>
`;

// Pre-create cached icons for common states to avoid Leaflet re-creating DOM elements
const MARKER_ICONS_CACHE = {
  normal: L.divIcon({
    className: 'plan-marker',
    html: createMarkerIconHtml(36, '#3388ff', '#2266cc'),
    iconSize: [36 * 0.7, 36],
    iconAnchor: [36 * 0.35, 36],
    popupAnchor: [0, -36],
  }),
  selected: L.divIcon({
    className: 'plan-marker selected',
    html: createMarkerIconHtml(40, '#e74c3c', '#c0392b'),
    iconSize: [40 * 0.7, 40],
    iconAnchor: [40 * 0.35, 40],
    popupAnchor: [0, -40],
  }),
  highlighted: L.divIcon({
    className: 'plan-marker highlighted',
    html: createMarkerIconHtml(44, '#3388ff', '#2266cc'),
    iconSize: [44 * 0.7, 44],
    iconAnchor: [44 * 0.35, 44],
    popupAnchor: [0, -44],
  }),
};

// Get cached marker icon - prevents recreating icons on every render
const getMarkerIcon = (isSelected = false, isHighlighted = false) => {
  if (isHighlighted) return MARKER_ICONS_CACHE.highlighted;
  if (isSelected) return MARKER_ICONS_CACHE.selected;
  return MARKER_ICONS_CACHE.normal;
};

// Legacy function for backwards compatibility (if needed elsewhere)
const createMarkerIcon = (isSelected = false, isHighlighted = false) => {
  const size = isHighlighted ? 44 : isSelected ? 40 : 36;
  const color = isSelected ? '#e74c3c' : '#3388ff';
  const strokeColor = isSelected ? '#c0392b' : '#2266cc';

  return L.divIcon({
    className: `plan-marker ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`,
    html: createMarkerIconHtml(size, color, strokeColor),
    iconSize: [size * 0.7, size],
    iconAnchor: [size * 0.35, size],
    popupAnchor: [0, -size],
  });
};

// Create small grey marker icon for reference waypoints
const createReferenceWaypointIcon = () => {
  return L.divIcon({
    className: 'plan-marker reference-waypoint',
    html: `
      <svg viewBox="0 0 24 36" width="20" height="30" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" 
              fill="#9ca3af" stroke="#6b7280" stroke-width="1"/>
        <circle cx="12" cy="12" r="4" fill="#fff"/>
      </svg>
    `,
    iconSize: [20, 30],
    iconAnchor: [10, 30],
    popupAnchor: [0, -30],
  });
};

const PlanMapView = forwardRef(({
  features,
  referenceTracks,
  trackData,
  selectedFeatureId,
  onSelectFeature,
  activeTool,
  activeDrawCategory,
  onAddFeature,
  onUpdateFeature,
  onDeleteFeature,
  readOnly,
  onDrawingStateChange,
}, ref) => {
  const [selectedLayer, setSelectedLayer] = useState('rudy');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [drawingState, setDrawingState] = useState({
    isDrawing: false,
    vertices: [],
    startPoint: null,
    currentPoint: null,
    center: null,
    radius: 0,
  });
  const [editingFeatureId, setEditingFeatureId] = useState(null);
  const mapRef = useRef(null);
  // FR-051: Store refs to reference track polyline layers for snap-to-track
  const referenceTrackLayersRef = useRef([]);

  // FR-051: Compute reference track coordinates for snap-to-track
  const referenceTrackCoords = useMemo(() => {
    if (!referenceTracks || !trackData) return [];
    
    return referenceTracks.map((track) => {
      const data = trackData[track.object_key];
      if (!data || !data.coordinates) return null;
      // coordinates from backend are [lat, lon], which is Leaflet's format
      return data.coordinates;
    }).filter(Boolean);
  }, [referenceTracks, trackData]);

  // Expose drawing state to parent
  useEffect(() => {
    if (onDrawingStateChange) {
      onDrawingStateChange(drawingState);
    }
  }, [drawingState, onDrawingStateChange]);

  // Reset drawing state when tool changes
  useEffect(() => {
    setDrawingState({
      isDrawing: false,
      vertices: [],
      startPoint: null,
      currentPoint: null,
      center: null,
      radius: 0,
    });
  }, [activeTool]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    finishDrawing: () => {
      if (!drawingState.isDrawing) return;
      
      if (activeTool === 'polyline' && drawingState.vertices.length >= 2) {
        const geometry = {
          type: 'LineString',
          coordinates: drawingState.vertices.map(([lat, lng]) => [lng, lat]),
        };
        onAddFeature(geometry, { category: activeDrawCategory || 'route' });
        setDrawingState({ isDrawing: false, vertices: [], startPoint: null, currentPoint: null, center: null, radius: 0 });
      } else if (activeTool === 'polygon' && drawingState.vertices.length >= 3) {
        const coords = drawingState.vertices.map(([lat, lng]) => [lng, lat]);
        coords.push(coords[0]); // Close the polygon
        const geometry = {
          type: 'Polygon',
          coordinates: [coords],
        };
        onAddFeature(geometry, { category: activeDrawCategory || 'area' });
        setDrawingState({ isDrawing: false, vertices: [], startPoint: null, currentPoint: null, center: null, radius: 0 });
      }
    },
    removeLastVertex: () => {
      if (drawingState.vertices.length > 0) {
        setDrawingState(prev => ({
          ...prev,
          vertices: prev.vertices.slice(0, -1),
          isDrawing: prev.vertices.length > 1,
        }));
      }
    },
    cancelDrawing: () => {
      setDrawingState({
        isDrawing: false,
        vertices: [],
        startPoint: null,
        currentPoint: null,
        center: null,
        radius: 0,
      });
    },
    getDrawingState: () => drawingState,
  }));

  // Default center (can be adjusted based on user location or last plan)
  const defaultCenter = [25.1, 121.5]; // Taiwan center
  const defaultZoom = 12;

  // Render point features as markers
  const renderMarker = useCallback((feature) => {
    const geom = feature.geometry;
    if (geom?.type !== 'Point' || !geom.coordinates) return null;

    const [lng, lat] = geom.coordinates;
    const isSelected = feature.id === selectedFeatureId;
    // Use cached icon to avoid recreating DOM elements on every render
    const icon = getMarkerIcon(isSelected);
    const isEditing = editingFeatureId === feature.id;

    return (
      <Marker
        key={feature.id}
        position={[lat, lng]}
        icon={icon}
        eventHandlers={{
          click: () => onSelectFeature(feature.id),
        }}
      >
        <Popup
          onOpen={() => setEditingFeatureId(null)}
          onClose={() => setEditingFeatureId(null)}
        >
          {isEditing ? (
            <FeatureStyleEditor
              feature={feature}
              onUpdate={onUpdateFeature}
              onClose={() => setEditingFeatureId(null)}
              readOnly={readOnly}
            />
          ) : (
            <div className="feature-popup">
              <div className="popup-header">
                <strong>{feature.properties?.name || 'Marker'}</strong>
                {!readOnly && (
                  <button
                    className="popup-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFeatureId(feature.id);
                    }}
                    title="Edit"
                  >
                    ✏️
                  </button>
                )}
              </div>
              {feature.properties?.description && (
                <p className="popup-description">{feature.properties.description}</p>
              )}
            </div>
          )}
        </Popup>
      </Marker>
    );
  }, [selectedFeatureId, onSelectFeature, editingFeatureId, onUpdateFeature, readOnly]);

  // Render polyline features
  const renderPolyline = useCallback((feature) => {
    const geom = feature.geometry;
    if (geom?.type !== 'LineString' || !geom.coordinates) return null;

    const positions = geom.coordinates.map(([lng, lat]) => [lat, lng]);
    const isSelected = feature.id === selectedFeatureId;
    const color = feature.properties?.color || '#3b82f6';
    const strokeWidth = feature.properties?.strokeWidth || 3;
    const opacity = feature.properties?.opacity ?? 0.8;
    const isEditing = editingFeatureId === feature.id;

    return (
      <Polyline
        key={feature.id}
        positions={positions}
        pathOptions={{
          color: isSelected ? '#ef4444' : color,
          weight: isSelected ? strokeWidth + 1 : strokeWidth,
          opacity,
        }}
        eventHandlers={{
          click: () => onSelectFeature(feature.id),
        }}
      >
        <Popup
          onOpen={() => setEditingFeatureId(null)}
          onClose={() => setEditingFeatureId(null)}
        >
          {isEditing ? (
            <FeatureStyleEditor
              feature={feature}
              onUpdate={onUpdateFeature}
              onClose={() => setEditingFeatureId(null)}
              readOnly={readOnly}
            />
          ) : (
            <div className="feature-popup">
              <div className="popup-header">
                <strong>{feature.properties?.name || '〰️ Route'}</strong>
                {!readOnly && (
                  <button
                    className="popup-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFeatureId(feature.id);
                    }}
                    title="Edit"
                  >
                    ✏️
                  </button>
                )}
              </div>
              {feature.properties?.description && (
                <p className="popup-description">{feature.properties.description}</p>
              )}
            </div>
          )}
        </Popup>
      </Polyline>
    );
  }, [selectedFeatureId, onSelectFeature, editingFeatureId, onUpdateFeature, readOnly]);

  // Render polygon features
  const renderPolygon = useCallback((feature) => {
    const geom = feature.geometry;
    if (geom?.type !== 'Polygon' || !geom.coordinates?.[0]) return null;

    const positions = geom.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const isSelected = feature.id === selectedFeatureId;
    const color = feature.properties?.color || '#16a34a';
    const fillColor = feature.properties?.fillColor || color;
    const strokeWidth = feature.properties?.strokeWidth || 2;
    const opacity = feature.properties?.opacity ?? 0.8;
    const fillOpacity = feature.properties?.fillOpacity ?? 0.2;
    const isEditing = editingFeatureId === feature.id;
    
    const shapeType = feature.properties?.shape_type;
    let label = '⬡ Polygon';
    if (shapeType === 'rectangle') label = '▭ Rectangle';
    else if (shapeType === 'circle') label = '◯ Circle';

    return (
      <Polygon
        key={feature.id}
        positions={positions}
        pathOptions={{
          color: isSelected ? '#ef4444' : color,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          opacity: opacity,
          weight: isSelected ? strokeWidth + 1 : strokeWidth,
        }}
        eventHandlers={{
          click: () => onSelectFeature(feature.id),
        }}
      >
        <Popup
          onOpen={() => setEditingFeatureId(null)}
          onClose={() => setEditingFeatureId(null)}
        >
          {isEditing ? (
            <FeatureStyleEditor
              feature={feature}
              onUpdate={onUpdateFeature}
              onClose={() => setEditingFeatureId(null)}
              readOnly={readOnly}
            />
          ) : (
            <div className="feature-popup">
              <div className="popup-header">
                <strong>{feature.properties?.name || label}</strong>
                {!readOnly && (
                  <button
                    className="popup-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFeatureId(feature.id);
                    }}
                    title="Edit"
                  >
                    ✏️
                  </button>
                )}
              </div>
              {feature.properties?.description && (
                <p className="popup-description">{feature.properties.description}</p>
              )}
            </div>
          )}
        </Popup>
      </Polygon>
    );
  }, [selectedFeatureId, onSelectFeature]);

  // Render all features
  const renderedFeatures = useMemo(() => {
    if (!features) return null;
    
    // Ensure features is an array
    const featuresArray = Array.isArray(features) ? features : (features.features || []);

    return featuresArray.map((feature) => {
      const type = feature.geometry?.type;
      if (type === 'Point') return renderMarker(feature);
      if (type === 'LineString') return renderPolyline(feature);
      if (type === 'Polygon') return renderPolygon(feature);
      return null;
    });
  }, [features, renderMarker, renderPolyline, renderPolygon]);

  // Render reference tracks
  const renderedReferenceTracks = useMemo(() => {
    if (!referenceTracks || !trackData) return null;

    const referenceIcon = createReferenceWaypointIcon();

    return referenceTracks.map((track) => {
      const data = trackData[track.object_key];
      if (!data || !data.coordinates) return null;

      // coordinates from backend are [lat, lon]
      return (
        <React.Fragment key={track.id}>
          <Polyline
            positions={data.coordinates}
            pathOptions={{
              color: track.color || '#888888',
              opacity: track.opacity || 0.6,
              weight: 3,
              dashArray: '5, 10', // Dashed line for reference tracks
            }}
          >
            <Popup>
              <div className="feature-popup">
                <strong>{track.display_name || 'Reference Track'}</strong>
              </div>
            </Popup>
          </Polyline>
          
          {data.waypoints && data.waypoints.map((wp, idx) => (
            <Marker
              key={`${track.id}-wp-${idx}`}
              position={[wp.lat, wp.lon]}
              icon={referenceIcon}
            >
              <Popup>
                <div className="feature-popup">
                  <div className="popup-header">
                    <strong>{wp.name || 'Waypoint'}</strong>
                  </div>
                  <p className="popup-description">
                    Reference: {track.display_name || 'GPX Track'}
                    {wp.elev !== undefined && <br /> + `Elev: ${Math.round(wp.elev)}m`}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </React.Fragment>
      );
    });
  }, [referenceTracks, trackData]);

  return (
    <div className="plan-map-view">
      {/* Layer switcher */}
      <div className="layer-switcher">
        <button 
          className="layer-switcher-btn"
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title="Change map layer"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
        </button>
        {showLayerMenu && (
          <div className="layer-menu">
            {Object.entries(MAP_LAYERS).map(([key, layer]) => (
              <button
                key={key}
                className={`layer-option ${selectedLayer === key ? 'active' : ''}`}
                onClick={() => {
                  setSelectedLayer(key);
                  setShowLayerMenu(false);
                }}
              >
                {layer.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="plan-map-container"
        ref={mapRef}
        scrollWheelZoom={true}
      >
        <TileLayer
          url={MAP_LAYERS['rudy'].url}
          attribution={MAP_LAYERS['rudy'].attribution}
        />

        <MapLayerController selectedLayer={selectedLayer} />
        <FeatureBoundsController 
          features={features} 
          referenceTracks={referenceTracks} 
          trackData={trackData} 
        />

        {!readOnly && activeTool && (
          <DrawingController 
            activeTool={activeTool}
            activeDrawCategory={activeDrawCategory}
            onAddFeature={onAddFeature}
            drawingState={drawingState}
            setDrawingState={setDrawingState}
            referenceTrackCoords={referenceTrackCoords}
          />
        )}

        {/* Drawing preview */}
        <DrawingPreview activeTool={activeTool} drawingState={drawingState} />

        {renderedReferenceTracks}
        {renderedFeatures}
      </MapContainer>
    </div>
  );
});

PlanMapView.displayName = 'PlanMapView';

export default PlanMapView;
