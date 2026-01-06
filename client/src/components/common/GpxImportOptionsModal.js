// client/src/components/common/GpxImportOptionsModal.js
/**
 * GpxImportOptionsModal - Modal for importing GPX waypoints into an EXISTING plan.
 * 
 * This modal is shown AFTER a GPX file has been analyzed (via ingestGpx API).
 * It allows users to:
 * 1. View the reference track toggle (always enabled for existing plans)
 * 2. Select which waypoints to import as Checkpoints
 * 3. Set a planned start date/time for time-shifting
 * 4. Apply the import to add checkpoints to the current plan
 * 
 * The time-shifting algorithm calculates new arrival times based on the delta
 * between each waypoint's original time and the GPX start time.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  GPX_INGESTION_STRATEGY,
  GPX_STRATEGY_LABELS,
  GPX_STRATEGY_DESCRIPTIONS
} from '../../services/planService';
import './GpxImportOptionsModal.css';

/**
 * Calculate the time-shifted arrival time for a waypoint.
 * 
 * Formula (from HLD 5.1):
 *   delta = waypoint.original_time - gpx_start_time
 *   new_arrival = plan_start_time + delta
 * 
 * @param {Date} waypointTime - Original waypoint time
 * @param {Date} gpxStartTime - Start time of the GPX track
 * @param {Date} planStartTime - User's planned start time
 * @returns {Date|null} Calculated arrival time, or null if times are missing
 */
const calculateTimeShift = (waypointTime, gpxStartTime, planStartTime) => {
  if (!waypointTime || !gpxStartTime || !planStartTime) {
    return null;
  }
  const deltaMs = waypointTime.getTime() - gpxStartTime.getTime();
  return new Date(planStartTime.getTime() + deltaMs);
};

/**
 * Calculate time offset in seconds from start time.
 * @param {Date} waypointTime - Original waypoint time
 * @param {Date} gpxStartTime - Start time of the GPX track
 * @returns {number|null} Offset in seconds
 */
const calculateTimeOffset = (waypointTime, gpxStartTime) => {
  if (!waypointTime || !gpxStartTime) {
    return null;
  }
  return Math.round((waypointTime.getTime() - gpxStartTime.getTime()) / 1000);
};

const GpxImportOptionsModal = ({
  isOpen,
  onClose,
  previewData,       // GpxIngestionPreview from ingestGpx API
  planStartDate,     // Current plan's planned_start_date (if set)
  onImport,          // Callback: (importedCheckpoints, referenceTrackKey) => void
}) => {
  // Waypoint selection state
  const [selectedWaypoints, setSelectedWaypoints] = useState(new Set());
  
  // Time strategy
  const [strategy, setStrategy] = useState(GPX_INGESTION_STRATEGY.RELATIVE);
  
  // Planned start date/time (for time shifting)
  const [startDateTime, setStartDateTime] = useState('');
  
  // Reference track option (always checked for existing plans)
  const [addAsReference, setAddAsReference] = useState(true);
  
  // UI state
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize with all waypoints selected and tomorrow 06:00 as default start
  useEffect(() => {
    if (previewData?.detected_waypoints) {
      setSelectedWaypoints(new Set(previewData.detected_waypoints.map((_, idx) => idx)));
    }
    
    // Set default start time to tomorrow 06:00 or plan's existing start date
    if (planStartDate) {
      // Use existing plan start date
      const date = new Date(planStartDate);
      setStartDateTime(formatDateTimeLocal(date));
    } else {
      // Default to tomorrow 06:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(6, 0, 0, 0);
      setStartDateTime(formatDateTimeLocal(tomorrow));
    }
  }, [previewData, planStartDate]);

  // Format date for datetime-local input
  const formatDateTimeLocal = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Format time for display
  const formatTime = (isoString) => {
    if (!isoString) return 'No time';
    try {
      const date = new Date(isoString);
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

  // Calculate preview of new arrival times
  const previewTimes = useMemo(() => {
    if (!previewData || strategy !== GPX_INGESTION_STRATEGY.RELATIVE || !startDateTime) {
      return {};
    }
    
    const gpxStart = previewData.gpx_start_time ? new Date(previewData.gpx_start_time) : null;
    const planStart = startDateTime ? new Date(startDateTime) : null;
    
    if (!gpxStart || !planStart) return {};
    
    const times = {};
    previewData.detected_waypoints.forEach((wp, idx) => {
      if (wp.time) {
        const wpTime = new Date(wp.time);
        const newArrival = calculateTimeShift(wpTime, gpxStart, planStart);
        times[idx] = newArrival;
      }
    });
    return times;
  }, [previewData, strategy, startDateTime]);

  // Toggle waypoint selection
  const toggleWaypoint = (index) => {
    setSelectedWaypoints(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Select/deselect all waypoints
  const toggleAllWaypoints = () => {
    if (selectedWaypoints.size === previewData?.detected_waypoints?.length) {
      setSelectedWaypoints(new Set());
    } else {
      setSelectedWaypoints(new Set(previewData?.detected_waypoints?.map((_, idx) => idx) || []));
    }
  };

  // Handle import button click
  const handleImport = useCallback(async () => {
    if (!previewData) return;
    
    setImporting(true);
    setError(null);
    
    try {
      const gpxStart = previewData.gpx_start_time ? new Date(previewData.gpx_start_time) : null;
      const planStart = startDateTime ? new Date(startDateTime) : null;
      
      // Build checkpoint features from selected waypoints
      const checkpoints = [];
      const selectedIndices = Array.from(selectedWaypoints).sort((a, b) => a - b);
      
      for (const idx of selectedIndices) {
        const wp = previewData.detected_waypoints[idx];
        
        // Calculate time values based on strategy
        let estimatedArrival = null;
        let timeOffsetSeconds = null;
        
        if (strategy === GPX_INGESTION_STRATEGY.RELATIVE && wp.time && gpxStart && planStart) {
          const wpTime = new Date(wp.time);
          estimatedArrival = calculateTimeShift(wpTime, gpxStart, planStart);
          timeOffsetSeconds = calculateTimeOffset(wpTime, gpxStart);
        } else if (strategy === GPX_INGESTION_STRATEGY.ABSOLUTE && wp.time) {
          estimatedArrival = new Date(wp.time);
          timeOffsetSeconds = gpxStart ? calculateTimeOffset(new Date(wp.time), gpxStart) : null;
        }
        // For NO_TIMES strategy, leave times as null
        
        // Create checkpoint feature matching PlanFeature schema
        const checkpoint = {
          geometry: {
            type: 'Point',
            coordinates: [wp.lon, wp.lat], // GeoJSON uses [lng, lat]
          },
          properties: {
            category: 'waypoint', // This makes it a Checkpoint in the UI
            name: wp.name || wp.note || `Checkpoint ${idx + 1}`,
            description: wp.ele ? `Original elevation: ${wp.ele.toFixed(0)}m` : null,
            elevation: wp.ele || null,
            estimated_arrival: estimatedArrival?.toISOString() || null,
            time_offset_seconds: timeOffsetSeconds,
            original_gpx_time: wp.time || null,
            order_index: checkpoints.length, // Maintain order
          },
        };
        
        checkpoints.push(checkpoint);
      }
      
      // Call the parent's import handler
      await onImport(checkpoints, addAsReference ? previewData.temp_file_key : null);
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message || 'Failed to import waypoints');
    } finally {
      setImporting(false);
    }
  }, [previewData, selectedWaypoints, strategy, startDateTime, addAsReference, onImport, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !previewData) return null;

  const waypoints = previewData.detected_waypoints || [];

  return (
    <div className="modal-backdrop gpx-import-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal-container gpx-import-options-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gpx-import-title"
      >
        <div className="modal-header">
          <h2 id="gpx-import-title">Import GPX Options</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          {/* Section A: Reference Track */}
          <div className="import-section">
            <h3 className="section-title">Reference Track</h3>
            <label className="reference-track-option disabled-option">
              <input
                type="checkbox"
                checked={addAsReference}
                onChange={(e) => setAddAsReference(e.target.checked)}
                disabled // Always add as reference for existing plans
              />
              <span>Add to map as reference track</span>
              <span className="option-hint">(Required)</span>
            </label>
          </div>

          {/* Section B: Waypoints Selection */}
          <div className="import-section">
            <h3 className="section-title">Waypoints Selection</h3>
            
            <div className="waypoint-list-header">
              <label className="select-all-checkbox">
                <input
                  type="checkbox"
                  checked={selectedWaypoints.size === waypoints.length && waypoints.length > 0}
                  onChange={toggleAllWaypoints}
                />
                <span>Select All</span>
              </label>
              <span className="selected-count">
                {selectedWaypoints.size} of {waypoints.length} selected
              </span>
            </div>

            <div className="waypoint-list">
              {waypoints.map((wp, idx) => (
                <label key={idx} className={`waypoint-item ${selectedWaypoints.has(idx) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedWaypoints.has(idx)}
                    onChange={() => toggleWaypoint(idx)}
                  />
                  <div className="waypoint-info">
                    <span className="waypoint-name">{wp.name || `Waypoint ${idx + 1}`}</span>
                    <div className="waypoint-times">
                      {wp.time && (
                        <span className="waypoint-original-time">
                          Original: {formatTime(wp.time)}
                        </span>
                      )}
                      {previewTimes[idx] && strategy === GPX_INGESTION_STRATEGY.RELATIVE && (
                        <span className="waypoint-new-time">
                          → New: {formatTime(previewTimes[idx].toISOString())}
                        </span>
                      )}
                    </div>
                  </div>
                  {wp.ele !== undefined && wp.ele !== null && (
                    <span className="waypoint-elevation">{Math.round(wp.ele)}m</span>
                  )}
                </label>
              ))}
              {waypoints.length === 0 && (
                <p className="no-waypoints">No waypoints detected in this GPX file.</p>
              )}
            </div>
          </div>

          {/* Section C: Time Strategy */}
          <div className="import-section">
            <h3 className="section-title">Time Strategy</h3>
            
            <div className="form-group">
              <label htmlFor="start-datetime">Planned Start Date/Time</label>
              <input
                type="datetime-local"
                id="start-datetime"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="datetime-input"
              />
              <p className="input-hint">
                System will recalculate arrival times based on the duration from the original track start.
              </p>
            </div>

            <div className="strategy-options">
              {Object.entries(GPX_INGESTION_STRATEGY).map(([key, value]) => (
                <label key={value} className={`strategy-option ${strategy === value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="strategy"
                    value={value}
                    checked={strategy === value}
                    onChange={() => setStrategy(value)}
                  />
                  <div className="strategy-content">
                    <span className="strategy-label">{GPX_STRATEGY_LABELS[value]}</span>
                    <span className="strategy-desc">{GPX_STRATEGY_DESCRIPTIONS[value]}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Track Summary */}
          {previewData.gpx_start_time && (
            <div className="track-summary">
              <span className="summary-label">Original Track:</span>
              <span className="summary-value">
                {formatTime(previewData.gpx_start_time)} - {formatTime(previewData.gpx_end_time)}
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
            disabled={importing || (selectedWaypoints.size === 0 && !addAsReference)}
          >
            {importing ? 'Importing...' : `Import ${selectedWaypoints.size} Checkpoints`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GpxImportOptionsModal;
