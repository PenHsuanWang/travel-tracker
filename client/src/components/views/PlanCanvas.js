// client/src/components/views/PlanCanvas.js
/**
 * PlanCanvas - Main editing view for a trip plan.
 * 
 * This component provides a full-page canvas for editing a plan with:
 * - A map view with drawing capabilities
 * - A toolbox panel for drawing tools
 * - An itinerary panel showing features list
 * - Reference track management
 * 
 * Follows the same patterns as TripDetailPage but adapted for plans.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PlanMapView from './PlanMapView';
import PlanToolbox from '../panels/PlanToolbox';
import ItineraryPanel from '../panels/ItineraryPanel';
import PromotePlanModal from '../common/PromotePlanModal';
import {
  getPlan,
  updatePlan,
  deletePlan,
  addFeature,
  updateFeature,
  deleteFeature,
  reorderFeatures,
  addReferenceTrack,
  removeReferenceTrack,
  promotePlanToTrip,
  getMarkerEmoji,
  PLAN_STATUS_LABELS,
} from '../../services/planService';
import '../../styles/PlanCanvas.css';

const MIN_ITINERARY_WIDTH = 280;
const MAX_ITINERARY_WIDTH = 500;
const DEFAULT_ITINERARY_WIDTH = 340;

const clampItineraryWidth = (value) =>
  Math.min(MAX_ITINERARY_WIDTH, Math.max(MIN_ITINERARY_WIDTH, value));

const getStoredItineraryWidth = () => {
  if (typeof window === 'undefined') return DEFAULT_ITINERARY_WIDTH;
  const stored = Number(window.localStorage.getItem('planItineraryWidth'));
  if (Number.isFinite(stored)) {
    return clampItineraryWidth(stored);
  }
  return DEFAULT_ITINERARY_WIDTH;
};

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
  const [activeTool, setActiveTool] = useState(null); // 'marker', 'polyline', 'polygon', 'rectangle', 'circle', etc.
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [itineraryOpen, setItineraryOpen] = useState(true);
  const [itineraryWidth, setItineraryWidth] = useState(() => getStoredItineraryWidth());
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [drawingState, setDrawingState] = useState({ isDrawing: false, vertices: [] });

  const mapRef = useRef(null);

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

  // Save itinerary width preference
  useEffect(() => {
    window.localStorage.setItem('planItineraryWidth', String(itineraryWidth));
  }, [itineraryWidth]);

  // Helper to extract features array from FeatureCollection
  const getFeaturesArray = useCallback((planData) => {
    if (!planData?.features) return [];
    // Handle both FeatureCollection object and direct array
    if (Array.isArray(planData.features)) {
      return planData.features;
    }
    // It's a FeatureCollection object
    return planData.features.features || [];
  }, []);

  // Feature operations
  const handleAddFeature = useCallback(
    async (geometry, properties = {}) => {
      if (!canEdit || !plan) return null;
      try {
        setSaving(true);
        const feature = await addFeature(planId, geometry, properties);
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
    [canEdit, plan, planId, getFeaturesArray]
  );

  const handleUpdateFeature = useCallback(
    async (featureId, updates) => {
      if (!canEdit || !plan) return;
      try {
        setSaving(true);
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
        // Reorder locally
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

  // Reference track operations
  const handleAddReferenceTrack = useCallback(
    async (trackData) => {
      if (!canEdit || !plan) return;
      try {
        setSaving(true);
        const track = await addReferenceTrack(planId, trackData);
        setPlan((prev) => ({
          ...prev,
          reference_tracks: [...(prev.reference_tracks || []), track],
        }));
      } catch (err) {
        console.error('Failed to add reference track:', err);
      } finally {
        setSaving(false);
      }
    },
    [canEdit, plan, planId]
  );

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

  // Plan name editing
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

  // Plan deletion
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

  // Plan promotion
  const handlePromote = async (options) => {
    try {
      setSaving(true);
      const result = await promotePlanToTrip(planId, options);
      setShowPromoteModal(false);
      navigate(`/trips/${result.trip_id}`);
    } catch (err) {
      console.error('Failed to promote plan:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Selected feature
  const selectedFeature = useMemo(() => {
    if (!plan || !selectedFeatureId) return null;
    const featuresArray = getFeaturesArray(plan);
    return featuresArray.find((f) => f.id === selectedFeatureId) || null;
  }, [plan, selectedFeatureId, getFeaturesArray]);

  // Get features array for passing to child components
  const featuresArray = useMemo(() => getFeaturesArray(plan), [plan, getFeaturesArray]);

  // Loading state
  if (loading) {
    return (
      <div className="plan-canvas-loading">
        <div className="spinner" />
        <p>Loading plan...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="plan-canvas-error">
        <h2>Unable to load plan</h2>
        <p>{error}</p>
        <Link to="/plans" className="btn-secondary">
          Back to Plans
        </Link>
      </div>
    );
  }

  // No plan found
  if (!plan) {
    return (
      <div className="plan-canvas-error">
        <h2>Plan not found</h2>
        <Link to="/plans" className="btn-secondary">
          Back to Plans
        </Link>
      </div>
    );
  }

  return (
    <div className="plan-canvas">
      {/* Header Bar */}
      <header className="plan-canvas-header">
        <div className="header-left">
          <Link to="/plans" className="back-link">
            ← Plans
          </Link>
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
          <span className={`status-badge status-${plan.status}`}>
            {PLAN_STATUS_LABELS[plan.status] || plan.status}
          </span>
        </div>

        <div className="header-right">
          {saving && <span className="saving-indicator">Saving...</span>}
          
          {canEdit && plan.status !== 'promoted' && (
            <button
              className="btn-promote"
              onClick={() => setShowPromoteModal(true)}
              disabled={saving}
            >
              🚀 Promote to Trip
            </button>
          )}

          <button
            className="btn-toggle-itinerary"
            onClick={() => setItineraryOpen(!itineraryOpen)}
          >
            {itineraryOpen ? '◀' : '▶'} Itinerary
          </button>

          {canManage && (
            <button
              className="btn-delete"
              onClick={handleDeletePlan}
              title="Delete plan"
            >
              🗑️
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="plan-canvas-content">
        {/* Toolbox */}
        {canEdit && (
          <PlanToolbox
            activeTool={activeTool}
            onSelectTool={(tool) => {
              setActiveTool(tool);
              setDrawingState({ isDrawing: false, vertices: [] });
            }}
            disabled={saving}
            isDrawing={drawingState.isDrawing}
            drawingVertices={drawingState.vertices?.length || 0}
            onFinishDrawing={() => mapRef.current?.finishDrawing?.()}
            onRemoveLastVertex={() => mapRef.current?.removeLastVertex?.()}
            onCancelDrawing={() => {
              mapRef.current?.cancelDrawing?.();
              setActiveTool(null);
            }}
          />
        )}

        {/* Map */}
        <div className="plan-map-container">
          <PlanMapView
            ref={mapRef}
            features={featuresArray}
            referenceTracks={plan.reference_tracks || []}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            activeTool={canEdit ? activeTool : null}
            onAddFeature={handleAddFeature}
            onUpdateFeature={handleUpdateFeature}
            onDeleteFeature={handleDeleteFeature}
            readOnly={!canEdit}
            onDrawingStateChange={setDrawingState}
          />
        </div>

        {/* Itinerary Panel */}
        {itineraryOpen && (
          <ItineraryPanel
            features={featuresArray}
            referenceTracks={plan.reference_tracks || []}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            onUpdateFeature={handleUpdateFeature}
            onDeleteFeature={handleDeleteFeature}
            onReorderFeatures={handleReorderFeatures}
            onAddReferenceTrack={handleAddReferenceTrack}
            onRemoveReferenceTrack={handleRemoveReferenceTrack}
            width={itineraryWidth}
            onWidthChange={setItineraryWidth}
            readOnly={!canEdit}
            getMarkerEmoji={getMarkerEmoji}
          />
        )}
      </div>

      {/* Promote Modal */}
      {showPromoteModal && (
        <PromotePlanModal
          plan={plan}
          onClose={() => setShowPromoteModal(false)}
          onPromote={handlePromote}
        />
      )}
    </div>
  );
};

export default PlanCanvas;
