// client/src/components/common/PromotePlanModal.js
/**
 * PromotePlanModal - Modal for promoting a plan to a trip.
 * 
 * Allows the user to configure promotion options:
 * - Copy reference tracks to the new trip
 * - Include planned route as ghost layer
 */
import React, { useState } from 'react';
import './PromotePlanModal.css';

const PromotePlanModal = ({ plan, onClose, onPromote }) => {
  const [copyReferenceTracks, setCopyReferenceTracks] = useState(true);
  const [includeGhostLayer, setIncludeGhostLayer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onPromote({
        copyReferenceTracks,
        includeGhostLayer,
      });
    } catch (err) {
      console.error('Promotion failed:', err);
      setError(err.response?.data?.detail || 'Failed to promote plan. Please try again.');
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  const trackCount = plan.reference_tracks?.length || 0;
  // Handle features being a FeatureCollection object or array
  const getFeaturesArray = () => {
    if (!plan.features) return [];
    if (Array.isArray(plan.features)) return plan.features;
    return plan.features.features || [];
  };
  const featureCount = getFeaturesArray().length;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal-container promote-plan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promote-modal-title"
      >
        <div className="modal-header">
          <h2 id="promote-modal-title">🚀 Promote to Trip</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="promote-intro">
              Promoting <strong>{plan.name}</strong> will create a new trip and
              mark this plan as promoted.
            </p>

            {error && <div className="form-error">{error}</div>}

            <div className="promote-summary">
              <div className="summary-item">
                <span className="summary-icon">📋</span>
                <div>
                  <strong>{featureCount}</strong> planned features
                </div>
              </div>
              <div className="summary-item">
                <span className="summary-icon">🛤️</span>
                <div>
                  <strong>{trackCount}</strong> reference tracks
                </div>
              </div>
            </div>

            <div className="promote-options">
              <h4>Promotion Options</h4>

              <label className="option-item">
                <input
                  type="checkbox"
                  checked={copyReferenceTracks}
                  onChange={(e) => setCopyReferenceTracks(e.target.checked)}
                  disabled={loading || trackCount === 0}
                />
                <div className="option-content">
                  <span className="option-label">Copy reference tracks</span>
                  <span className="option-desc">
                    {trackCount > 0
                      ? `Attach ${trackCount} GPX track${trackCount > 1 ? 's' : ''} to the new trip`
                      : 'No reference tracks to copy'}
                  </span>
                </div>
              </label>

              <label className="option-item">
                <input
                  type="checkbox"
                  checked={includeGhostLayer}
                  onChange={(e) => setIncludeGhostLayer(e.target.checked)}
                  disabled={loading || featureCount === 0}
                />
                <div className="option-content">
                  <span className="option-label">Include ghost layer</span>
                  <span className="option-desc">
                    {featureCount > 0
                      ? 'Show your planned route as a reference layer on the trip map'
                      : 'No features to include'}
                  </span>
                </div>
              </label>
            </div>

            <div className="promote-note">
              <span className="note-icon">💡</span>
              <span>
                After promotion, you'll be redirected to the new trip where you
                can upload actual GPX tracks and photos from your adventure.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-promote"
              disabled={loading}
            >
              {loading ? 'Promoting...' : 'Promote to Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromotePlanModal;
