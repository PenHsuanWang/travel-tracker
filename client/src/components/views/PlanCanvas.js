// client/src/components/views/PlanCanvas.js
/**
 * PlanCanvas - Main editing view for a trip plan.
 * 
 * Phase 2 Architecture:
 * - Zone A (Left Sidebar): PlanToolbox + OperationsPanel (Team, Gear, Settings)
 * - Zone B (Center Canvas): PlanMapView + PlanStatsHUD
 * - Zone C (Right Sidebar): ItineraryPanel (Day Grouping)
 * 
 * Follows the same patterns as TripDetailPage but adapted for plans.
 * 
 * Migrated to use unified components (Phase 4.4):
 * - LoadingState for loading spinner
 * - Unified button classes
 * - useResizablePanel hook
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PlanMapView from './PlanMapView';
import PlanToolbox from '../panels/PlanToolbox';
import OperationsPanel from '../panels/OperationsPanel';
import ItineraryPanel from '../panels/ItineraryPanel';
import PlanStatsHUD from '../panels/PlanStatsHUD';
import { LoadingState } from '../common/LoadingState';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import {
  getPlan,
  updatePlan,
  deletePlan,
  addFeature,
  updateFeature,
  updateFeatureWithCascade,
  deleteFeature,
  reorderFeatures,
  addReferenceTrack,
  uploadReferenceTrack,
  removeReferenceTrack,
  ingestGpx,
  updateLogistics,
  updateDaySummaries,
  PLAN_STATUS_LABELS,
  FEATURE_CATEGORY,
  SEMANTIC_TYPE,
  ROUTE_TYPE,
} from '../../services/planService';
import { fetchGpxAnalysis } from '../../services/api';
import { calculateLengthKm, calculateAreaSqM } from '../../utils/geoUtils';
import GpxImportOptionsModal from '../common/GpxImportOptionsModal';
import '../../styles/PlanCanvas.css';

const PlanCanvas = () => {
  const { isAuthenticated, user } = useAuth();
  const { planId } = useParams();
  const navigate = useNavigate();

  // Plan state
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // UI state
  const [activeTool, setActiveTool] = useState(null);
  const [activeDrawCategory, setActiveDrawCategory] = useState(null);
  const [activeSemanticType, setActiveSemanticType] = useState(SEMANTIC_TYPE.GENERIC);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [drawingState, setDrawingState] = useState({ isDrawing: false, vertices: [] });
  const [trackData, setTrackData] = useState({});
  const [daySummaries, setDaySummaries] = useState([]);
  const [daySummariesDirty, setDaySummariesDirty] = useState(false);
  
  // Phase 2 - Logistics state
  const [localRoster, setLocalRoster] = useState([]);
  const [localLogistics, setLocalLogistics] = useState({});
  const [localChecklist, setLocalChecklist] = useState([]);
  
  // GPX Import Modal state
  const [gpxImportModalOpen, setGpxImportModalOpen] = useState(false);
  const [gpxPreviewData, setGpxPreviewData] = useState(null);
  const [uploadingGpx, setUploadingGpx] = useState(false);

  const mapRef = useRef(null);

  // Panel State Management using hooks
  const leftPanel = useResizablePanel({
    initialWidth: 300,
    minWidth: 280,
    maxWidth: 500,
    storageKey: 'planLeftSidebarWidth',
  });

  const itineraryPanel = useResizablePanel({
    initialWidth: 340,
    minWidth: 280,
    maxWidth: 500,
    storageKey: 'planItineraryWidth',
  });

  // Permissions
  const userId = user ? (user.id || user._id) : null;
  const isOwner = useMemo(() => {
    if (!userId || !plan) return false;
    return String(plan.owner_id) === String(userId);
  }, [userId, plan]);

  const isMember = useMemo(() => {
    if (!userId || !plan || !plan.member_ids) return false;
    return plan.member_ids.some((mid) => String(mid) === String(userId));
  }, [userId, plan]);

  const canEdit = isOwner || isMember;
  const canManage = isOwner;

  // Fetch plan
  const fetchPlan = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getPlan(planId);
      setPlan(data);
      setLocalRoster(data.roster || []);
      setLocalLogistics(data.logistics || {});
      setLocalChecklist(data.checklist || []);
      setDaySummaries(data.day_summaries || []);
      setDaySummariesDirty(false);
    } catch (err) {
      console.error('Failed to fetch plan:', err);
      setError('Failed to load plan. It may not exist or you may not have access.');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Fetch reference track data
  useEffect(() => {
    if (!plan?.reference_tracks) return;

    const loadTracks = async () => {
      const newTrackData = { ...trackData };
      let hasUpdates = false;

      await Promise.all(plan.reference_tracks.map(async (track) => {
        if (!newTrackData[track.object_key]) {
          try {
            const analysis = await fetchGpxAnalysis(track.object_key);
            if (analysis && analysis.coordinates) {
              newTrackData[track.object_key] = analysis;
              hasUpdates = true;
            }
          } catch (err) {
            console.error(`Failed to load track ${track.object_key}:`, err);
          }
        }
      }));

      if (hasUpdates) {
        setTrackData(newTrackData);
      }
    };

    loadTracks();
  }, [plan?.reference_tracks, trackData]);

  // Helper to extract features array from FeatureCollection
  const getFeaturesArray = useCallback((planData) => {
    if (!planData?.features) return [];
    if (Array.isArray(planData.features)) {
      return planData.features;
    }
    return planData.features.features || [];
  }, []);

  // Feature operations
  const handleAddFeature = useCallback(
    async (geometry, properties = {}) => {
      if (!canEdit || !plan) return null;
      try {
        setSaving(true);
        const semantic_type = properties.semantic_type || activeSemanticType || SEMANTIC_TYPE.GENERIC;
        const featureProps = {
          semantic_type,
          ...properties,
        };

        if (geometry.type === 'LineString') {
          featureProps.distance_km = calculateLengthKm(geometry);
        } else if (geometry.type === 'Polygon') {
          featureProps.area_sq_m = calculateAreaSqM(geometry);
        }

        if (!featureProps.route_type && featureProps.category === FEATURE_CATEGORY.ROUTE) {
          featureProps.route_type = ROUTE_TYPE.MAIN;
        }

        const feature = await addFeature(planId, geometry, featureProps);
        setPlan((prev) => {
          const currentFeatures = getFeaturesArray(prev);
          return {
            ...prev,
            features: {
              type: 'FeatureCollection',
              features: [...currentFeatures, feature],
            },
          };
        });
        setSelectedFeatureId(feature.id);
        setActiveTool(null);
        return feature;
      } catch (err) {
        console.error('Failed to add feature:', err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId, getFeaturesArray, activeSemanticType]
  );

  const handleUpdateFeature = useCallback(
    async (featureId, updates) => {
      if (!canEdit || !plan) return;
      try {
        setSaving(true);
        
        const geometry = updates.geometry;
        if (geometry) {
           if (!updates.properties) updates.properties = {};
           if (geometry.type === 'LineString') {
             updates.properties.distance_km = calculateLengthKm(geometry);
           } else if (geometry.type === 'Polygon') {
             updates.properties.area_sq_m = calculateAreaSqM(geometry);
           }
        }

        const updated = await updateFeature(planId, featureId, updates);
        setPlan((prev) => {
          const currentFeatures = getFeaturesArray(prev);
          return {
            ...prev,
            features: {
              type: 'FeatureCollection',
              features: currentFeatures.map((f) => (f.id === featureId ? updated : f)),
            },
          };
        });
      } catch (err) {
        console.error('Failed to update feature:', err);
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId, getFeaturesArray]
  );

  const handleUpdateFeatureWithCascade = useCallback(
    async (featureId, updates) => {
      if (!canEdit || !plan) return;
      try {
        setSaving(true);
        const updatedPlan = await updateFeatureWithCascade(planId, featureId, updates, true);
        setPlan(updatedPlan);
      } catch (err) {
        console.error('Failed to update feature with cascade:', err);
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId]
  );

  const handleDeleteFeature = useCallback(
    async (featureId) => {
      if (!canEdit || !plan) return;
      if (!window.confirm('Delete this feature?')) return;
      try {
        setSaving(true);
        await deleteFeature(planId, featureId);
        setPlan((prev) => {
          const currentFeatures = getFeaturesArray(prev);
          return {
            ...prev,
            features: {
              type: 'FeatureCollection',
              features: currentFeatures.filter((f) => f.id !== featureId),
            },
          };
        });
        if (selectedFeatureId === featureId) {
          setSelectedFeatureId(null);
        }
      } catch (err) {
        console.error('Failed to delete feature:', err);
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId, selectedFeatureId, getFeaturesArray]
  );

  const handleReorderFeatures = useCallback(
    async (featureOrders) => {
      if (!canEdit || !plan) return;
      try {
        setSaving(true);
        await reorderFeatures(planId, featureOrders);
        const orderMap = new Map(featureOrders.map((o) => [o.feature_id, o.order_index]));
        setPlan((prev) => {
          const currentFeatures = getFeaturesArray(prev);
          return {
            ...prev,
            features: {
              type: 'FeatureCollection',
              features: [...currentFeatures].sort(
                (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999)
              ),
            },
          };
        });
      } catch (err) {
        console.error('Failed to reorder features:', err);
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId, getFeaturesArray]
  );

  const handleAddReferenceTrack = useCallback(
    async (fileOrData) => {
      if (!canEdit || !plan) return;
      
      if (fileOrData instanceof File) {
        try {
          setUploadingGpx(true);
          const previewData = await ingestGpx(fileOrData);
          setGpxPreviewData({
            ...previewData,
            file: fileOrData,
            fileName: fileOrData.name,
          });
          setGpxImportModalOpen(true);
        } catch (err) {
          console.error('Failed to parse GPX file:', err);
          alert('Failed to parse GPX file. Please check the file format.');
        } finally {
          setUploadingGpx(false);
        }
        return;
      }
      
      try {
        setSaving(true);
        const track = await addReferenceTrack(planId, fileOrData);
        setPlan((prev) => ({
          ...prev,
          reference_tracks: [...(prev.reference_tracks || []), track],
        }));
      } catch (err) {
        console.error('Failed to add reference track:', err);
        alert('Failed to add reference track. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId]
  );

  const handleGpxImport = useCallback(
    async (checkpoints, tempFileKey) => {
      if (!canEdit || !plan || !gpxPreviewData) return;
      
      try {
        setSaving(true);
        setGpxImportModalOpen(false);
        
        const createdFeatures = [];
        for (const checkpoint of checkpoints) {
          const geometry = checkpoint.geometry;
          const properties = {
            category: checkpoint.properties?.category || 'waypoint',
            name: checkpoint.properties?.name || 'Checkpoint',
            description: checkpoint.properties?.description,
            estimated_arrival: checkpoint.properties?.estimated_arrival,
            time_offset_seconds: checkpoint.properties?.time_offset_seconds,
            source: 'gpx_import',
            original_gpx_time: checkpoint.properties?.original_gpx_time,
            elevation: checkpoint.properties?.elevation,
            order_index: checkpoint.properties?.order_index,
          };
          
          const feature = await addFeature(planId, geometry, properties);
          createdFeatures.push(feature);
        }
        
        let track = null;
        if (tempFileKey && gpxPreviewData.file) {
          track = await uploadReferenceTrack(planId, gpxPreviewData.file, {
            display_name: gpxPreviewData.fileName.replace(/\.gpx$/i, ''),
          });
        }
        
        setPlan((prev) => {
          const updatedPlan = { ...prev };
          if (createdFeatures.length > 0) {
            const currentFeatures = getFeaturesArray(prev);
            updatedPlan.features = {
              type: 'FeatureCollection',
              features: [...currentFeatures, ...createdFeatures],
            };
          }
          if (track) {
            const trackWithVisibility = {
              ...track,
              showTrack: true,
              showWaypoints: false,
            };
            updatedPlan.reference_tracks = [...(prev.reference_tracks || []), trackWithVisibility];
          }
          return updatedPlan;
        });
        
        setGpxPreviewData(null);
        
      } catch (err) {
        console.error('Failed to import GPX data:', err);
        alert('Failed to import GPX data. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId, gpxPreviewData, getFeaturesArray]
  );

  const handleGpxImportCancel = useCallback(() => {
    setGpxImportModalOpen(false);
    setGpxPreviewData(null);
  }, []);

  const handleRemoveReferenceTrack = useCallback(
    async (trackId) => {
      if (!canEdit || !plan) return;
      if (!window.confirm('Remove this reference track?')) return;
      try {
        setSaving(true);
        await removeReferenceTrack(planId, trackId);
        setPlan((prev) => ({
          ...prev,
          reference_tracks: prev.reference_tracks.filter((t) => t.id !== trackId),
        }));
      } catch (err) {
        console.error('Failed to remove reference track:', err);
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId]
  );

  const handleToggleTrackVisibility = useCallback(
    (trackId, property, value) => {
      setPlan((prev) => ({
        ...prev,
        reference_tracks: prev.reference_tracks.map((track) =>
          track.id === trackId ? { ...track, [property]: value } : track
        ),
      }));
    },
    []
  );

  const handleStartEditName = () => {
    if (!canManage) return;
    setEditedName(plan?.name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    try {
      setSaving(true);
      const updated = await updatePlan(planId, { name: editedName.trim() });
      setPlan(updated);
    } catch (err) {
      console.error('Failed to update plan name:', err);
    } finally {
      setSaving(false);
      setIsEditingName(false);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handleDeletePlan = async () => {
    if (!canManage) return;
    if (!window.confirm('Delete this plan? This cannot be undone.')) return;
    try {
      await deletePlan(planId);
      navigate('/plans');
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  const handleSaveLogistics = useCallback(async () => {
    if (!canEdit || !plan) return;
    try {
      setSaving(true);
      const updatedPlan = await updateLogistics(planId, {
        roster: localRoster,
        logistics: localLogistics,
        checklist: localChecklist,
      });
      setPlan(updatedPlan);
    } catch (err) {
      console.error('Failed to save logistics:', err);
      alert('Failed to save logistics data. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [canEdit, plan, planId, localRoster, localLogistics, localChecklist]);

  const handleUpdateDaySummaries = useCallback((updatedSummaries) => {
    setDaySummaries(updatedSummaries);
    setDaySummariesDirty(true);
  }, []);

  const handleSaveDaySummaries = useCallback(async () => {
    if (!canEdit || !plan) return;
    try {
      setSaving(true);
      const updatedPlan = await updateDaySummaries(planId, daySummaries);
      setPlan(updatedPlan);
      setDaySummaries(updatedPlan.day_summaries || []);
      setDaySummariesDirty(false);
    } catch (err) {
      console.error('Failed to save day summaries:', err);
      alert('Failed to save day summaries. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [canEdit, plan, planId, daySummaries]);

  const handleUpdatePlanMetadata = useCallback(async (updates) => {
    if (!canEdit || !plan) return;
    try {
      setSaving(true);
      const updatedPlan = await updatePlan(planId, updates);
      setPlan(updatedPlan);
    } catch (err) {
      console.error('Failed to update plan:', err);
    } finally {
      setSaving(false);
    }
  }, [canEdit, plan, planId]);

  const selectedFeature = useMemo(() => {
    if (!plan || !selectedFeatureId) return null;
    const featuresArray = getFeaturesArray(plan);
    return featuresArray.find((f) => f.id === selectedFeatureId) || null;
  }, [plan, selectedFeatureId, getFeaturesArray]);

  const featuresArray = useMemo(() => getFeaturesArray(plan), [plan, getFeaturesArray]);

  // Compute grid columns
  const gridTemplate = `${leftPanel.width}px 1fr ${itineraryPanel.width}px`;

  if (loading) {
    return (
      <div className="plan-canvas-loading">
        <LoadingState message="Loading plan..." size="lg" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="plan-canvas-error">
        <h2>Plan not found</h2>
        <Link to="/plans" className="btn btn-secondary">
          Back to Plans
        </Link>
      </div>
    );
  }

  return (
    <div className="plan-canvas">
      {/* Header Bar */}
      <header className="plan-canvas-header">
        <div className="plan-header-left">
          <Link to="/plans" className="back-link">
            ← Back to Plans
          </Link>
          <div className="plan-title-block">
            {isEditingName ? (
              <div className="name-editor">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEditName();
                  }}
                />
                <button onClick={handleSaveName} disabled={saving}>
                  ✓
                </button>
                <button onClick={handleCancelEditName}>✕</button>
              </div>
            ) : (
              <h1 className="plan-title" onClick={handleStartEditName}>
                {plan.name || 'Untitled Plan'}
                {canManage && <span className="edit-hint">✏️</span>}
              </h1>
            )}
          </div>
        </div>

        <div className="plan-header-right header-actions">
          <span className={`status-badge status-${plan.status}`}>
            {PLAN_STATUS_LABELS[plan.status] || plan.status}
          </span>
          
          {saving && <span className="saving-indicator">Saving...</span>}
          
          <button
            className="header-btn btn-toggle-sidebar"
            onClick={leftPanel.toggleCollapse}
            title={!leftPanel.isCollapsed ? 'Hide Operations Panel' : 'Show Operations Panel'}
          >
            {!leftPanel.isCollapsed ? '◀ Hide Ops' : '▶ Show Ops'}
          </button>
          
          <div className="header-center-controls">
            <button
              className="header-btn btn-toggle-itinerary"
              onClick={itineraryPanel.toggleCollapse}
            >
              {!itineraryPanel.isCollapsed ? 'Hide Itinerary ▶' : '◀ Show Itinerary'}
            </button>
          </div>
          {canManage && (
            <button
              className="header-btn btn-delete"
              onClick={handleDeletePlan}
              title="Delete plan"
            >
              Delete Plan
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div
        className={`plan-canvas-content ${leftPanel.isCollapsed ? 'left-collapsed' : ''} ${itineraryPanel.isCollapsed ? 'right-collapsed' : ''}`}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        
        {/* Zone A: Left Sidebar (Operations) */}
        {!leftPanel.isCollapsed && (
          <div className="plan-left-sidebar">
            <div className="left-resize-handle" onMouseDown={leftPanel.handleMouseDown} />
            {canEdit && (
              <PlanToolbox
                activeTool={activeTool}
                onSelectTool={(tool, category) => {
                  setActiveTool(tool);
                  setActiveDrawCategory(category);
                  setDrawingState({ isDrawing: false, vertices: [] });
                }}
                activeSemanticType={activeSemanticType}
                onSelectSemanticType={setActiveSemanticType}
                selectedFeature={selectedFeature}
                onUpdateFeature={handleUpdateFeature}
                disabled={saving}
                isDrawing={drawingState.isDrawing}
                drawingVertices={drawingState.vertices?.length || 0}
                onFinishDrawing={() => mapRef.current?.finishDrawing?.()}
                onRemoveLastVertex={() => mapRef.current?.removeLastVertex?.()}
                onCancelDrawing={() => {
                  mapRef.current?.cancelDrawing?.();
                  setActiveTool(null);
                  setActiveDrawCategory(null);
                }}
                embedded={true}
              />
            )}
            
            <OperationsPanel
              plan={plan}
              roster={localRoster}
              logistics={localLogistics}
              checklist={localChecklist}
              onUpdateRoster={setLocalRoster}
              onUpdateLogistics={setLocalLogistics}
              onUpdateChecklist={setLocalChecklist}
              onUpdatePlan={handleUpdatePlanMetadata}
              onSave={handleSaveLogistics}
              saving={saving}
              readOnly={!canEdit}
            />
          </div>
        )}

        {/* Zone B: Center Canvas (Map) */}
        <div className="plan-center-canvas">
          <div className="plan-map-container">
            <PlanMapView
              key={planId}
              ref={mapRef}
              features={featuresArray}
              referenceTracks={plan.reference_tracks || []}
              trackData={trackData}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={setSelectedFeatureId}
              activeTool={canEdit ? activeTool : null}
              activeSemanticType={activeSemanticType}
              activeDrawCategory={activeDrawCategory}
              onAddFeature={handleAddFeature}
              onUpdateFeature={handleUpdateFeature}
              onDeleteFeature={handleDeleteFeature}
              readOnly={!canEdit}
              onDrawingStateChange={setDrawingState}
            />
          </div>

          <PlanStatsHUD
            features={featuresArray}
            referenceTracks={plan.reference_tracks || []}
            trackData={trackData}
            onSelectFeature={setSelectedFeatureId}
            onFlyToFeature={(featureId) => {
              if (mapRef.current?.flyToFeature) {
                mapRef.current.flyToFeature(featureId);
              }
              setSelectedFeatureId(featureId);
            }}
            onFlyToTrack={(trackId) => {
              if (mapRef.current?.flyToTrack) {
                mapRef.current.flyToTrack(trackId);
              }
            }}
          />
        </div>

        {/* Zone C: Right Sidebar (Itinerary) */}
        {!itineraryPanel.isCollapsed && (
          <ItineraryPanel
            features={featuresArray}
            referenceTracks={plan.reference_tracks || []}
            planStartDate={plan.planned_start_date}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            onUpdateFeature={handleUpdateFeature}
            onUpdateFeatureWithCascade={handleUpdateFeatureWithCascade}
            onDeleteFeature={handleDeleteFeature}
            onReorderFeatures={handleReorderFeatures}
            onCenterFeature={(featureId, coords) => {
              if (mapRef.current?.centerOnCoords) {
                mapRef.current.centerOnCoords(coords);
              }
              setSelectedFeatureId(featureId);
            }}
            onFlyToFeature={(featureId) => {
              if (mapRef.current?.flyToFeature) {
                mapRef.current.flyToFeature(featureId);
              }
              setSelectedFeatureId(featureId);
            }}
            onEditFeature={(featureId) => {
              if (mapRef.current?.openFeaturePopup) {
                mapRef.current.openFeaturePopup(featureId);
              }
              setSelectedFeatureId(featureId);
            }}
            onAddReferenceTrack={handleAddReferenceTrack}
            onRemoveReferenceTrack={handleRemoveReferenceTrack}
            onToggleTrackVisibility={handleToggleTrackVisibility}
            width={itineraryPanel.actualWidth}
            onWidthChange={itineraryPanel.setWidth}
            daySummaries={daySummaries}
            onUpdateDaySummaries={handleUpdateDaySummaries}
            onSaveDaySummaries={handleSaveDaySummaries}
            daySummariesDirty={daySummariesDirty}
            savingDaySummaries={saving}
            readOnly={!canEdit}
          />
        )}
      </div>

      {gpxImportModalOpen && gpxPreviewData && (
        <GpxImportOptionsModal
          isOpen={gpxImportModalOpen}
          onClose={handleGpxImportCancel}
          onImport={handleGpxImport}
          previewData={gpxPreviewData}
          planStartDate={plan.planned_start_date}
        />
      )}

    </div>
  );
};

export default PlanCanvas;
