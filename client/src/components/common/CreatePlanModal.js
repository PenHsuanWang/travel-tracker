// client/src/components/common/CreatePlanModal.js
/**
 * CreatePlanModal - Modal for creating a new trip plan.
 * 
 * Similar to CreateTripModal but for plans. Plans are simpler initially
 * and don't require GPX upload at creation time.
 */
import React, { useState, useEffect } from 'react';
import { createPlan } from '../../services/planService';
import userService from '../../services/userService';
import './CreatePlanModal.css';

const CreatePlanModal = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    region: '',
    planned_start_date: '',
    planned_end_date: '',
    is_public: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Member Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searching, setSearching] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setSearching(true);
        try {
          const results = await userService.searchUsers(searchQuery);
          setSearchResults(results);
        } catch (err) {
          console.error('Search failed', err);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddMember = (user) => {
    if (!selectedMembers.find((m) => m.id === user.id)) {
      setSelectedMembers((prev) => [...prev, user]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveMember = (userId) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate name
    if (!formData.name.trim()) {
      setLoading(false);
      setError('Plan name is required.');
      return;
    }

    // Validate date ordering
    if (formData.planned_start_date && formData.planned_end_date) {
      const start = new Date(formData.planned_start_date);
      const end = new Date(formData.planned_end_date);
      if (start > end) {
        setLoading(false);
        setError('Start date must be on or before end date.');
        return;
      }
    }

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        region: formData.region.trim() || null,
        planned_start_date: formData.planned_start_date || null,
        planned_end_date: formData.planned_end_date || null,
        is_public: formData.is_public,
        member_ids: selectedMembers.map((m) => m.id),
      };

      const newPlan = await createPlan(payload);
      onCreated(newPlan);
    } catch (err) {
      console.error('Failed to create plan:', err);
      const message =
        err.response?.data?.detail || 'Failed to create plan. Please try again.';
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
        className="modal-container create-plan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-plan-title"
      >
        <div className="modal-header">
          <h2 id="create-plan-title">Create New Plan</h2>
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

            {/* Name */}
            <div className="form-group">
              <label htmlFor="plan-name">Plan Name *</label>
              <input
                type="text"
                id="plan-name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Summer Backpacking Trip"
                required
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="plan-description">Description</label>
              <textarea
                id="plan-description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of your planned trip..."
                rows={3}
              />
            </div>

            {/* Region */}
            <div className="form-group">
              <label htmlFor="plan-region">Region</label>
              <input
                type="text"
                id="plan-region"
                name="region"
                value={formData.region}
                onChange={handleChange}
                placeholder="e.g., Swiss Alps, Pacific Crest Trail"
              />
            </div>

            {/* Dates */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="plan-start-date">Planned Start</label>
                <input
                  type="date"
                  id="plan-start-date"
                  name="planned_start_date"
                  value={formData.planned_start_date}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="plan-end-date">Planned End</label>
                <input
                  type="date"
                  id="plan-end-date"
                  name="planned_end_date"
                  value={formData.planned_end_date}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Public toggle */}
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleChange}
                />
                Make this plan public
              </label>
              <span className="form-hint">
                Public plans can be viewed by anyone.
              </span>
            </div>

            {/* Members */}
            <div className="form-group">
              <label>Invite Members</label>
              <div className="member-search">
                <input
                  type="text"
                  placeholder="Search users by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searching && <span className="search-spinner">...</span>}
              </div>

              {searchResults.length > 0 && (
                <ul className="search-results">
                  {searchResults.map((user) => (
                    <li key={user.id} onClick={() => handleAddMember(user)}>
                      <span className="user-avatar">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" />
                        ) : (
                          user.username?.charAt(0).toUpperCase() || '?'
                        )}
                      </span>
                      <span className="user-name">{user.username}</span>
                      <span className="add-icon">+</span>
                    </li>
                  ))}
                </ul>
              )}

              {selectedMembers.length > 0 && (
                <div className="selected-members">
                  {selectedMembers.map((member) => (
                    <span key={member.id} className="member-chip">
                      {member.username}
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        aria-label={`Remove ${member.username}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
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

export default CreatePlanModal;
