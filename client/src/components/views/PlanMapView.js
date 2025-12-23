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

// Drawing controller - handles map clicks when a tool is active
function DrawingController({ 
  activeTool, 
  activeDrawCategory,
  onAddFeature,
  drawingState,
  setDrawingState,
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      if (!activeTool) return;

      const { lat, lng } = e.latlng;

      if (activeTool === 'marker' || activeTool === 'waypoint') {
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
function FeatureBoundsController({ features, referenceTracks }) {
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

    // TODO: Also include reference track bounds when implemented

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
  }, [features, referenceTracks, map]);

  return null;
}

// Create blue teardrop marker icons
const createMarkerIcon = (isSelected = false, isHighlighted = false) => {
  const size = isHighlighted ? 44 : isSelected ? 40 : 36;
  const color = isSelected ? '#e74c3c' : '#3388ff';
  const strokeColor = isSelected ? '#c0392b' : '#2266cc';

  return L.divIcon({
    className: `plan-marker ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`,
    html: `
      <svg viewBox="0 0 24 36" width="${size * 0.7}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" 
              fill="${color}" stroke="${strokeColor}" stroke-width="1"/>
        <circle cx="12" cy="12" r="5" fill="#fff"/>
      </svg>
    `,
    iconSize: [size * 0.7, size],
    iconAnchor: [size * 0.35, size],
    popupAnchor: [0, -size],
  });
};

const PlanMapView = forwardRef(({
  features,
  referenceTracks,
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
    const icon = createMarkerIcon(isSelected);
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

  // TODO: Render reference tracks as dashed polylines

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
        <FeatureBoundsController features={features} referenceTracks={referenceTracks} />

        {!readOnly && activeTool && (
          <DrawingController 
            activeTool={activeTool}
            activeDrawCategory={activeDrawCategory}
            onAddFeature={onAddFeature}
            drawingState={drawingState}
            setDrawingState={setDrawingState}
          />
        )}

        {/* Drawing preview */}
        <DrawingPreview activeTool={activeTool} drawingState={drawingState} />

        {renderedFeatures}
      </MapContainer>
    </div>
  );
});

PlanMapView.displayName = 'PlanMapView';

export default PlanMapView;
