// client/src/components/common/CloneToPlanModal.js
/**
 * CloneToPlanModal - Modal for cloning a Trip to a new Plan.
 * 
 * This modal allows users to:
 * 1. Set a name for the new plan
 * 2. Set a planned start date
 * 3. Choose time import strategy
 * 4. Clone the trip's GPX data to create a new plan
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  importTripToPlan,
  GPX_INGESTION_STRATEGY,
  GPX_STRATEGY_LABELS,
  GPX_STRATEGY_DESCRIPTIONS
} from '../../services/planService';
import './CloneToPlanModal.css';

const CloneToPlanModal = ({ tripId, tripName, onClose, onCreated }) => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: `${tripName || 'Trip'} Plan`,
    planned_start_date: '',
  });
  const [strategy, setStrategy] = useState(GPX_INGESTION_STRATEGY.RELATIVE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [navigateOnCreate, setNavigateOnCreate] = useState(true);

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

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Plan name is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const newPlan = await importTripToPlan(tripId, {
        name: formData.name.trim(),
        planned_start_date: formData.planned_start_date || null,
        strategy: strategy,
      });
      
      if (onCreated) {
        onCreated(newPlan);
      }
      
      onClose();
      
      if (navigateOnCreate) {
        navigate(`/plans/${newPlan.id}`);
      }
    } catch (err) {
      console.error('Failed to clone trip to plan:', err);
      const message = err.response?.data?.detail || 'Failed to create plan from trip';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal-container clone-to-plan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-to-plan-title"
      >
        <div className="modal-header">
          <h2 id="clone-to-plan-title">Clone Trip to Plan</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <p className="clone-description">
              Create a new trip plan based on the GPX data from <strong>"{tripName}"</strong>. 
              Waypoints and tracks will be copied to the new plan.
            </p>

            <div className="form-group">
              <label htmlFor="plan-name">Plan Name *</label>
              <input
                type="text"
                id="plan-name"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="e.g., Summer Backpacking Plan"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="plan-start-date">Planned Start Date</label>
              <input
                type="date"
                id="plan-start-date"
                name="planned_start_date"
                value={formData.planned_start_date}
                onChange={handleFormChange}
              />
              <span className="form-hint">
                Waypoint times will be projected from this date if using relative time strategy
              </span>
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

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={navigateOnCreate}
                  onChange={(e) => setNavigateOnCreate(e.target.checked)}
                />
                <span>Open plan after creating</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CloneToPlanModal;
