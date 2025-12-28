// client/src/components/views/PlanMapView.js
/**
 * PlanMapView - Map view for the plan canvas with drawing support.
 * 
 * Displays plan features (markers, polylines, polygons) and reference tracks.
 * When a drawing tool is active, clicking on the map creates that feature type.
 * Supports OpenTopoMap and other tile layers with a layer switcher.
 */
import React, { useEffect, useMemo, useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, Popup, Circle, Rectangle, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import FeatureStyleEditor from '../common/FeatureStyleEditor';
import { SEMANTIC_TYPE, ROUTE_TYPE } from '../../services/planService';
import { getSemanticIcon, ICON_CONFIG } from '../../utils/mapIcons';
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

// FE-04: Double-click handler for smart drawing completion
function DoubleClickDrawHandler({
  activeTool,
  activeDrawCategory,
  onAddFeature,
  drawingState,
  setDrawingState,
}) {
  const map = useMap();

  useMapEvents({
    dblclick(e) {
      // Only handle double-click during active drawing
      if (!activeTool || !drawingState.isDrawing) return;
      
      // Stop propagation to prevent map zoom
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      
      const { lat, lng } = e.latlng;
      
      // FR-30: Double-click to finish polygon
      if (activeTool === 'polygon' && drawingState.vertices?.length >= 2) {
        // Add the final vertex and complete the shape
        const finalVertices = [...drawingState.vertices, [lat, lng]];
        if (finalVertices.length >= 3) {
          const coords = finalVertices.map(([lt, ln]) => [ln, lt]);
          coords.push(coords[0]); // Close the polygon
          const geometry = {
            type: 'Polygon',
            coordinates: [coords],
          };
          onAddFeature(geometry, { category: activeDrawCategory || 'area' });
          setDrawingState({
            isDrawing: false,
            vertices: [],
            startPoint: null,
            currentPoint: null,
            center: null,
            radius: 0,
          });
        }
        return;
      }
      
      // FR-30: Double-click to finish polyline
      if (activeTool === 'polyline' && drawingState.vertices?.length >= 1) {
        const finalVertices = [...drawingState.vertices, [lat, lng]];
        if (finalVertices.length >= 2) {
          const geometry = {
            type: 'LineString',
            coordinates: finalVertices.map(([lt, ln]) => [ln, lt]),
          };
          onAddFeature(geometry, { category: activeDrawCategory || 'route' });
          setDrawingState({
            isDrawing: false,
            vertices: [],
            startPoint: null,
            currentPoint: null,
            center: null,
            radius: 0,
          });
        }
        return;
      }
    },
  });

  // Disable default map double-click zoom when drawing
  useEffect(() => {
    if (activeTool && drawingState.isDrawing) {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
    return () => {
      map.doubleClickZoom.enable();
    };
  }, [activeTool, drawingState.isDrawing, map]);

  return null;
}

// Drawing controller - handles map clicks when a tool is active
function DrawingController({ 
  activeTool, 
  activeDrawCategory,
  activeSemanticType,
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
          semantic_type: activeSemanticType || undefined,
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

// Palette for semantic styling
const SEMANTIC_PALETTES = {
  [SEMANTIC_TYPE.WATER]: { marker: '#0ea5e9', stroke: '#0284c7', fill: '#bfdbfe' },
  [SEMANTIC_TYPE.CAMP]: { marker: '#f97316', stroke: '#ea580c', fill: '#fed7aa' },
  [SEMANTIC_TYPE.SIGNAL]: { marker: '#8b5cf6', stroke: '#7c3aed', fill: '#ddd6fe' },
  [SEMANTIC_TYPE.HAZARD]: { marker: '#dc2626', stroke: '#b91c1c', fill: '#fecdd3' },
  [SEMANTIC_TYPE.CHECKIN]: { marker: '#f59e0b', stroke: '#d97706', fill: '#fde68a' },
  [SEMANTIC_TYPE.GENERIC]: { marker: '#14b8a6', stroke: '#0d9488', fill: '#99f6e4' },
};

const getSemanticPalette = (semanticType) => SEMANTIC_PALETTES[semanticType] || SEMANTIC_PALETTES[SEMANTIC_TYPE.GENERIC];

// Create teardrop marker with semantic-aware colors
const createMarkerIconHtml = (size, color, strokeColor) => `
  <svg viewBox="0 0 24 36" width="${size * 0.7}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" 
          fill="${color}" stroke="${strokeColor}" stroke-width="1"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/>
  </svg>
`;

const MARKER_ICON_CACHE = new Map();

const getSemanticMarkerIcon = (semanticType, isSelected = false, isHighlighted = false) => {
  const palette = getSemanticPalette(semanticType);
  const size = isHighlighted ? 44 : isSelected ? 40 : 36;
  // Keep the fill color as the semantic color so types remain distinguishable.
  const color = palette.marker;
  // Use a stronger stroke when selected to indicate selection without losing semantic color.
  const strokeColor = isSelected ? '#ef4444' : palette.stroke;
  const key = `${semanticType || 'generic'}-${size}-${color}-${strokeColor}-${isSelected}`;

  if (!MARKER_ICON_CACHE.has(key)) {
    MARKER_ICON_CACHE.set(
      key,
      L.divIcon({
        className: `plan-marker checkpoint ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`,
        html: createMarkerIconHtml(size, color, strokeColor),
        iconSize: [size * 0.7, size],
        iconAnchor: [size * 0.35, size],
        popupAnchor: [0, -size],
      })
    );
  }

  return MARKER_ICON_CACHE.get(key);
};

// FE-05: Polygon component with SVG pattern fill support
// Standard Leaflet pathOptions don't support SVG patterns, so we use a ref
// to directly manipulate the SVG path element after render
const PatternPolygon = ({ positions, pathOptions, fillPattern, fillColor, children, eventHandlers }) => {
  const polygonRef = useRef(null);

  // Apply SVG pattern fill directly to the path element when fillPattern is 'crosshatch'
  useEffect(() => {
    if (!polygonRef.current) return;
    
    const pathElement = polygonRef.current.getElement();
    if (!pathElement) return;

    if (fillPattern === 'crosshatch') {
      // Create a unique pattern ID based on the fill color
      const patternId = `crosshatch-${fillColor.replace('#', '')}`;
      
      // Check if pattern already exists, if not create it
      let existingPattern = document.getElementById(patternId);
      if (!existingPattern) {
        // Find or create the SVG defs element
        let svgDefs = document.getElementById('plan-map-patterns');
        if (!svgDefs) {
          const svgNS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(svgNS, 'svg');
          svg.setAttribute('id', 'plan-map-patterns-container');
          svg.style.position = 'absolute';
          svg.style.width = '0';
          svg.style.height = '0';
          
          svgDefs = document.createElementNS(svgNS, 'defs');
          svgDefs.setAttribute('id', 'plan-map-patterns');
          svg.appendChild(svgDefs);
          document.body.appendChild(svg);
        }
        
        // Create the crosshatch pattern
        const svgNS = 'http://www.w3.org/2000/svg';
        const pattern = document.createElementNS(svgNS, 'pattern');
        pattern.setAttribute('id', patternId);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', '8');
        pattern.setAttribute('height', '8');
        pattern.setAttribute('patternTransform', 'rotate(45)');
        
        // Add line element for the hatch
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '0');
        line.setAttribute('x2', '0');
        line.setAttribute('y2', '8');
        line.setAttribute('stroke', fillColor);
        line.setAttribute('stroke-width', '2');
        
        pattern.appendChild(line);
        svgDefs.appendChild(pattern);
      }
      
      // Apply the pattern to the path
      pathElement.style.fill = `url(#${patternId})`;
      pathElement.style.fillOpacity = pathOptions.fillOpacity || 0.5;
    } else {
      // Reset to normal fill
      pathElement.style.fill = pathOptions.fillColor || fillColor;
      pathElement.style.fillOpacity = pathOptions.fillOpacity;
    }
  }, [fillPattern, fillColor, pathOptions.fillOpacity, pathOptions.fillColor]);

  return (
    <Polygon
      ref={polygonRef}
      positions={positions}
      pathOptions={pathOptions}
      eventHandlers={eventHandlers}
    >
      {children}
    </Polygon>
  );
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
  activeSemanticType,
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
  const resizeObserverRef = useRef(null);

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

  // Invalidate map size when its container resizes (sidebar drag, etc.)
  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance || typeof mapInstance.getContainer !== 'function' || typeof mapInstance.invalidateSize !== 'function') {
      return undefined;
    }
    const container = mapInstance.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    let frame = null;
    const observer = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        mapInstance.invalidateSize({ debounceMoveend: true });
      });
    });
    observer.observe(container);
    resizeObserverRef.current = observer;

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

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

  // FE-06: Feature highlight flash animation state
  const [flashingFeatureId, setFlashingFeatureId] = useState(null);

  // FE-06: Flash a feature 3 times for navigation confirmation
  const flashFeature = useCallback((featureId) => {
    setFlashingFeatureId(featureId);
    // Clear flash after animation completes (3 flashes * 500ms = 1500ms)
    setTimeout(() => {
      setFlashingFeatureId(null);
    }, 1500);
  }, []);

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
    
    // FE-06: Fly to a feature and flash it for navigation confirmation
    flyToFeature: (featureId) => {
      if (!mapRef.current || !features) return;
      
      const map = mapRef.current;
      const featuresArray = Array.isArray(features) ? features : (features.features || []);
      const feature = featuresArray.find(f => f.id === featureId);
      
      if (!feature || !feature.geometry) return;
      
      const geom = feature.geometry;
      
      // FE-06: FlyTo with appropriate zoom based on feature type
      if (geom.type === 'Point' && geom.coordinates) {
        const [lng, lat] = geom.coordinates;
        map.flyTo([lat, lng], 16, { duration: 1.0 }); // Close-up zoom for points
      } else if (geom.type === 'LineString' && geom.coordinates) {
        const positions = geom.coordinates.map(([lng, lat]) => [lat, lng]);
        const bounds = L.latLngBounds(positions);
        if (bounds.isValid()) {
          map.flyToBounds(bounds, { padding: [50, 50], duration: 1.0, maxZoom: 16 });
        }
      } else if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
        const positions = geom.coordinates[0].map(([lng, lat]) => [lat, lng]);
        const bounds = L.latLngBounds(positions);
        if (bounds.isValid()) {
          map.flyToBounds(bounds, { padding: [50, 50], duration: 1.0, maxZoom: 16 });
        }
      }
      
      // FE-06: Flash the feature after flyTo animation
      setTimeout(() => {
        flashFeature(featureId);
      }, 1000); // Wait for flyTo to complete
    },
    
    // Center on coordinates (for simple centering without flash)
    centerOnCoords: (coords) => {
      if (mapRef.current && coords) {
        mapRef.current.flyTo(coords, 15, { duration: 0.5 });
      }
    },

    // Fly to reference track bounds
    flyToTrack: (trackId) => {
      if (!mapRef.current || !referenceTracks || !trackData) return;
      
      const track = referenceTracks.find(t => t.id === trackId);
      if (!track) return;
      
      const data = trackData[track.object_key];
      if (!data || !data.coordinates || data.coordinates.length === 0) return;
      
      const bounds = L.latLngBounds(data.coordinates);
      if (bounds.isValid()) {
        mapRef.current.flyToBounds(bounds, { padding: [50, 50], duration: 1.0, maxZoom: 16 });
      }
    },
  }));

  // Default center (can be adjusted based on user location or last plan)
  const defaultCenter = [25.1, 121.5]; // Taiwan center
  const defaultZoom = 12;

  // FE-06: Create a flashing marker icon
  const getFlashingMarkerIcon = useCallback((semanticType, isSelected = false) => {
    const size = 40;
    const palette = getSemanticPalette(semanticType);
    const color = palette.marker;
    const strokeColor = isSelected ? '#e74c3c' : palette.stroke;
    
    return L.divIcon({
      className: 'plan-marker checkpoint flashing',
      html: createMarkerIconHtml(size, color, strokeColor),
      iconSize: [size * 0.7, size],
      iconAnchor: [size * 0.35, size],
      popupAnchor: [0, -size],
    });
  }, []);

  // Render point features as markers
  const renderMarker = useCallback((feature) => {
    const geom = feature.geometry;
    if (geom?.type !== 'Point' || !geom.coordinates) return null;

    const [lng, lat] = geom.coordinates;
    const isSelected = feature.id === selectedFeatureId;
    const isFlashing = feature.id === flashingFeatureId;
    const semanticType = feature.properties?.semantic_type || SEMANTIC_TYPE.GENERIC;
    // Use cached icon or flashing icon
    const icon = isFlashing
      ? getFlashingMarkerIcon(semanticType, isSelected)
      : getSemanticIcon(semanticType, { size: 36, selected: isSelected, highlighted: false });
    const isEditing = editingFeatureId === feature.id;

    // FE-07: Tooltip content for hover
    const tooltipContent = feature.properties?.name || 'Marker';

    const semanticConfig = ICON_CONFIG[semanticType] || ICON_CONFIG[SEMANTIC_TYPE.GENERIC];
    const displayTitle = feature.properties?.name || semanticConfig.label.toUpperCase();

    return (
      <Marker
        key={feature.id}
        position={[lat, lng]}
        icon={icon}
        eventHandlers={{
          click: () => onSelectFeature(feature.id),
        }}
      >
        {/* FE-07: Hover tooltip for glanceability */}
        <Tooltip
          direction="auto"
          offset={[0, -20]}
          opacity={1}
          className="plan-feature-tooltip"
          interactive={false}
        >
          {tooltipContent}
        </Tooltip>
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
                <strong>
                  <span style={{ marginRight: '6px' }}>{semanticConfig.emoji}</span>
                  {displayTitle}
                </strong>
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
  }, [selectedFeatureId, onSelectFeature, editingFeatureId, onUpdateFeature, readOnly, flashingFeatureId, getFlashingMarkerIcon]);

  // Render polyline features
  const renderPolyline = useCallback((feature) => {
    const geom = feature.geometry;
    if (geom?.type !== 'LineString' || !geom.coordinates) return null;

    const positions = geom.coordinates.map(([lng, lat]) => [lat, lng]);
    const isSelected = feature.id === selectedFeatureId;
    const isFlashing = feature.id === flashingFeatureId;
    const semanticType = feature.properties?.semantic_type || SEMANTIC_TYPE.GENERIC;
    const palette = getSemanticPalette(semanticType);
    const routeType = feature.properties?.route_type;
    const color = routeType === ROUTE_TYPE.ESCAPE ? '#16a34a' : (feature.properties?.color || palette.stroke || '#3b82f6');
    const strokeWidth = feature.properties?.strokeWidth || feature.properties?.stroke_width || 3;
    const dashArray = routeType === ROUTE_TYPE.ESCAPE ? '8, 6' : (semanticType === SEMANTIC_TYPE.SIGNAL ? '4, 6' : feature.properties?.dashArray);
    // FE-06: Flashing effect - alternate opacity
    const opacity = isFlashing ? 0.4 : (feature.properties?.opacity ?? 0.8);
    const isEditing = editingFeatureId === feature.id;

    // FE-07: Tooltip content for hover
    const tooltipContent = feature.properties?.name || '〰️ Route';

    return (
      <Polyline
        key={feature.id}
        positions={positions}
        pathOptions={{
          color: isSelected ? '#ef4444' : color,
          weight: isFlashing ? strokeWidth + 2 : (isSelected ? strokeWidth + 1 : strokeWidth),
          opacity,
          className: isFlashing ? 'feature-flashing' : '',
          dashArray,
        }}
        eventHandlers={{
          click: () => onSelectFeature(feature.id),
        }}
      >
        {/* FE-07: Hover tooltip for glanceability */}
        <Tooltip
          direction="auto"
          offset={[0, 0]}
          opacity={1}
          className="plan-feature-tooltip"
          interactive={false}
          sticky={true}
        >
          {tooltipContent}
        </Tooltip>
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
  }, [selectedFeatureId, onSelectFeature, editingFeatureId, onUpdateFeature, readOnly, flashingFeatureId]);

  // Render polygon features
  const renderPolygon = useCallback((feature) => {
    const geom = feature.geometry;
    if (geom?.type !== 'Polygon' || !geom.coordinates?.[0]) return null;

    const positions = geom.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const isSelected = feature.id === selectedFeatureId;
    const isFlashing = feature.id === flashingFeatureId;
    const semanticType = feature.properties?.semantic_type || SEMANTIC_TYPE.GENERIC;
    const palette = getSemanticPalette(semanticType);
    const color = feature.properties?.color || palette.stroke || '#16a34a';
    const fillColor = feature.properties?.fillColor || feature.properties?.fill_color || palette.fill || color;
    const strokeWidth = feature.properties?.strokeWidth || feature.properties?.stroke_width || 2;
    // FE-05: Fill pattern support
    const fillPattern =
      semanticType === SEMANTIC_TYPE.HAZARD
        ? 'crosshatch'
        : (feature.properties?.fillPattern || feature.properties?.fill_pattern || 'solid');
    // FE-06: Flashing effect
    const opacity = isFlashing ? 0.4 : (feature.properties?.opacity ?? 0.8);
    // FE-05: Apply fill opacity based on pattern
    let fillOpacity = isFlashing ? 0.1 : (feature.properties?.fillOpacity ?? feature.properties?.fill_opacity ?? 0.2);
    if (semanticType === SEMANTIC_TYPE.HAZARD) {
      fillOpacity = 0.18;
    }
    if (fillPattern === 'none') {
      fillOpacity = 0; // No fill for 'none' pattern
    }
    const isEditing = editingFeatureId === feature.id;
    
    const shapeType = feature.properties?.shape_type;
    let label = '⬡ Polygon';
    if (shapeType === 'rectangle') label = '▭ Rectangle';
    else if (shapeType === 'circle') label = '◯ Circle';

    // FE-07: Tooltip content for hover
    const tooltipContent = feature.properties?.name || label;

    // FE-05: Use PatternPolygon for crosshatch support
    return (
      <PatternPolygon
        key={feature.id}
        positions={positions}
        fillPattern={fillPattern}
        fillColor={fillColor}
        pathOptions={{
          color: isSelected ? '#ef4444' : color,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          opacity: opacity,
          weight: isFlashing ? strokeWidth + 2 : (isSelected ? strokeWidth + 1 : strokeWidth),
          className: isFlashing ? 'feature-flashing' : '',
        }}
        eventHandlers={{
          click: () => onSelectFeature(feature.id),
        }}
      >
        {/* FE-07: Hover tooltip for glanceability */}
        <Tooltip
          direction="auto"
          offset={[0, 0]}
          opacity={1}
          className="plan-feature-tooltip"
          interactive={false}
          sticky={true}
        >
          {tooltipContent}
        </Tooltip>
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
      </PatternPolygon>
    );
  }, [selectedFeatureId, onSelectFeature, editingFeatureId, onUpdateFeature, readOnly, flashingFeatureId]);

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

  // Render reference tracks with UI-01 casing technique (double-layered lines)
  const renderedReferenceTracks = useMemo(() => {
    if (!referenceTracks || !trackData) return null;

    const referenceIcon = createReferenceWaypointIcon();

    return referenceTracks.map((track) => {
      const data = trackData[track.object_key];
      if (!data || !data.coordinates) return null;
      
      // UI-02/03: Check track visibility settings (default: track visible, waypoints hidden after import)
      const showTrack = track.showTrack !== false; // Default true
      const showWaypoints = track.showWaypoints === true; // Default false after import

      // coordinates from backend are [lat, lon]
      return (
        <React.Fragment key={track.id}>
          {/* UI-01: Casing technique - white halo underneath for visibility on terrain maps */}
          {showTrack && (
            <Polyline
              positions={data.coordinates}
              pathOptions={{
                color: '#ffffff',
                opacity: 0.8,
                weight: 6,
              }}
            />
          )}
          {/* UI-01: Main dashed line on top */}
          {showTrack && (
            <Polyline
              positions={data.coordinates}
              pathOptions={{
                color: track.color || '#555555',
                opacity: 0.9,
                weight: 3,
                dashArray: '10, 10', // Dashed line for reference tracks
              }}
            >
              <Popup>
                <div className="feature-popup">
                  <strong>{track.display_name || 'Reference Track'}</strong>
                </div>
              </Popup>
            </Polyline>
          )}
          
          {/* UI-02: Reference waypoints - hidden by default after import */}
          {showWaypoints && data.waypoints && data.waypoints.map((wp, idx) => (
            <Marker
              key={`${track.id}-wp-${idx}`}
              position={[wp.lat, wp.lon]}
              icon={referenceIcon}
              zIndexOffset={-1000} // UI-04: Lower z-index than checkpoints
            >
              <Popup>
                <div className="feature-popup">
                  <div className="popup-header">
                    <strong>{wp.name || wp.note || 'Waypoint'}</strong>
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
              activeSemanticType={activeSemanticType}
              onAddFeature={onAddFeature}
              drawingState={drawingState}
              setDrawingState={setDrawingState}
              referenceTrackCoords={referenceTrackCoords}
            />
        )}

        {/* FE-04: Double-click to finish drawing handler */}
        {!readOnly && activeTool && (
          <DoubleClickDrawHandler
            activeTool={activeTool}
            activeDrawCategory={activeDrawCategory}
            onAddFeature={onAddFeature}
            drawingState={drawingState}
            setDrawingState={setDrawingState}
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
