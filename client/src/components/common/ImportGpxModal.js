// client/src/components/common/ImportGpxModal.js
/**
 * ImportGpxModal - Modal for importing GPX files into a new plan.
 * 
 * This modal handles:
 * 1. GPX file upload and preview
 * 2. Waypoint selection from detected waypoints
 * 3. Time import strategy selection (relative, absolute, no_times)
 * 4. Plan metadata input (name, dates, etc.)
 * 5. Creating a new plan with the selected options
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  ingestGpx, 
  createPlanWithGpx,
  GPX_INGESTION_STRATEGY,
  GPX_STRATEGY_LABELS,
  GPX_STRATEGY_DESCRIPTIONS
} from '../../services/planService';
import './ImportGpxModal.css';

const ImportGpxModal = ({ onClose, onCreated }) => {
  // Step management
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'configure'
  
  // Upload state
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  // Preview data from backend
  const [previewData, setPreviewData] = useState(null);
  
  // Waypoint selection
  const [selectedWaypoints, setSelectedWaypoints] = useState(new Set());
  
  // Import strategy
  const [strategy, setStrategy] = useState(GPX_INGESTION_STRATEGY.RELATIVE);
  
  // Plan form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    region: '',
    planned_start_date: '',
    planned_end_date: '',
    is_public: false,
  });
  
  // Submit state
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Auto-populate plan name from filename
  useEffect(() => {
    if (file && !formData.name) {
      const baseName = file.name.replace(/\.gpx$/i, '');
      setFormData(prev => ({ ...prev, name: baseName }));
    }
  }, [file, formData.name]);

  // Handle file selection
  const handleFileSelect = useCallback((selectedFile) => {
    setUploadError(null);
    
    if (!selectedFile.name.toLowerCase().endsWith('.gpx')) {
      setUploadError('Please select a GPX file (.gpx extension)');
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setUploadError('File size exceeds 10MB limit');
      return;
    }
    
    setFile(selectedFile);
  }, []);

  // Drag and drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Upload and analyze GPX
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setUploadError(null);
    
    try {
      const preview = await ingestGpx(file);
      setPreviewData(preview);
      
      // Select all waypoints by default
      const allIndices = new Set(preview.detected_waypoints.map((_, idx) => idx));
      setSelectedWaypoints(allIndices);
      
      setStep('preview');
    } catch (err) {
      console.error('GPX upload failed:', err);
      const message = err.response?.data?.detail || 'Failed to analyze GPX file';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

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
    if (selectedWaypoints.size === previewData.detected_waypoints.length) {
      setSelectedWaypoints(new Set());
    } else {
      setSelectedWaypoints(new Set(previewData.detected_waypoints.map((_, idx) => idx)));
    }
  };

  // Form change handler
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Create plan with GPX
  const handleCreatePlan = async () => {
    if (!formData.name.trim()) {
      setCreateError('Plan name is required');
      return;
    }
    
    setCreating(true);
    setCreateError(null);
    
    try {
      const gpxStrategy = {
        temp_file_key: previewData.temp_file_key,
        mode: strategy,
        selected_waypoint_indices: Array.from(selectedWaypoints),
      };
      
      const planData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        region: formData.region.trim() || null,
        planned_start_date: formData.planned_start_date || null,
        planned_end_date: formData.planned_end_date || null,
        is_public: formData.is_public,
      };
      
      const newPlan = await createPlanWithGpx(planData, gpxStrategy);
      onCreated(newPlan);
    } catch (err) {
      console.error('Failed to create plan:', err);
      const message = err.response?.data?.detail || 'Failed to create plan';
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
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

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal-container import-gpx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-gpx-title"
      >
        <div className="modal-header">
          <h2 id="import-gpx-title">
            {step === 'upload' && 'Import GPX File'}
            {step === 'preview' && 'Select Waypoints'}
            {step === 'configure' && 'Configure Plan'}
          </h2>
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
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <>
              {uploadError && <div className="form-error">{uploadError}</div>}
              
              <div
                className={`gpx-dropzone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="file-selected">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{file.name}</span>
                    <button
                      type="button"
                      className="file-remove"
                      onClick={() => setFile(null)}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="dropzone-content">
                    <span className="dropzone-icon">📂</span>
                    <p className="dropzone-text">
                      Drag and drop a GPX file here, or
                    </p>
                    <label className="file-input-label">
                      <span>Browse Files</span>
                      <input
                        type="file"
                        accept=".gpx"
                        onChange={handleFileInput}
                        hidden
                      />
                    </label>
                    <p className="dropzone-hint">Maximum file size: 10MB</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 2: Preview waypoints */}
          {step === 'preview' && previewData && (
            <>
              <div className="preview-summary">
                <div className="summary-item">
                  <span className="summary-label">Track Duration:</span>
                  <span className="summary-value">
                    {formatTime(previewData.gpx_start_time)} - {formatTime(previewData.gpx_end_time)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Detected Waypoints:</span>
                  <span className="summary-value">{previewData.detected_waypoints.length}</span>
                </div>
              </div>

              <div className="waypoint-list-header">
                <label className="select-all-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedWaypoints.size === previewData.detected_waypoints.length}
                    onChange={toggleAllWaypoints}
                  />
                  <span>Select All</span>
                </label>
                <span className="selected-count">
                  {selectedWaypoints.size} of {previewData.detected_waypoints.length} selected
                </span>
              </div>

              <div className="waypoint-list">
                {previewData.detected_waypoints.map((wp, idx) => (
                  <label key={idx} className="waypoint-item">
                    <input
                      type="checkbox"
                      checked={selectedWaypoints.has(idx)}
                      onChange={() => toggleWaypoint(idx)}
                    />
                    <div className="waypoint-info">
                      <span className="waypoint-name">{wp.name || `Waypoint ${idx + 1}`}</span>
                      {wp.time && (
                        <span className="waypoint-time">{formatTime(wp.time)}</span>
                      )}
                    </div>
                    {wp.elevation && (
                      <span className="waypoint-elevation">{wp.elevation.toFixed(0)}m</span>
                    )}
                  </label>
                ))}
                {previewData.detected_waypoints.length === 0 && (
                  <p className="no-waypoints">No waypoints detected in this GPX file.</p>
                )}
              </div>

              <div className="form-group strategy-group">
                <label>Time Import Strategy</label>
                <div className="strategy-options">
                  {Object.entries(GPX_INGESTION_STRATEGY).map(([key, value]) => (
                    <label key={value} className="strategy-option">
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
            </>
          )}

          {/* Step 3: Configure plan */}
          {step === 'configure' && (
            <>
              {createError && <div className="form-error">{createError}</div>}

              <div className="form-group">
                <label htmlFor="plan-name">Plan Name *</label>
                <input
                  type="text"
                  id="plan-name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="e.g., Summer Backpacking Trip"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="plan-description">Description</label>
                <textarea
                  id="plan-description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Brief description of your planned trip..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="plan-region">Region</label>
                <input
                  type="text"
                  id="plan-region"
                  name="region"
                  value={formData.region}
                  onChange={handleFormChange}
                  placeholder="e.g., Swiss Alps, Pacific Crest Trail"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="plan-start-date">Planned Start Date</label>
                  <input
                    type="date"
                    id="plan-start-date"
                    name="planned_start_date"
                    value={formData.planned_start_date}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="plan-end-date">Planned End Date</label>
                  <input
                    type="date"
                    id="plan-end-date"
                    name="planned_end_date"
                    value={formData.planned_end_date}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="is_public"
                    checked={formData.is_public}
                    onChange={handleFormChange}
                  />
                  <span>Make this plan public</span>
                </label>
              </div>

              <div className="import-summary">
                <h4>Import Summary</h4>
                <ul>
                  <li>{selectedWaypoints.size} waypoints will be imported</li>
                  <li>Strategy: {GPX_STRATEGY_LABELS[strategy]}</li>
                  {previewData?.track_geometry && (
                    <li>Track line will be added as reference</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {step === 'upload' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? 'Analyzing...' : 'Analyze GPX'}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('upload')}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep('configure')}
                disabled={selectedWaypoints.size === 0 && !previewData.track_geometry}
              >
                Continue
              </button>
            </>
          )}

          {step === 'configure' && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('preview')}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreatePlan}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Plan'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportGpxModal;
