// client/src/components/views/PlansPage.js
/**
 * PlansPage - Displays a list of user's trip plans.
 * 
 * This component follows the same patterns as TripsPage but for the Plan entity.
 * Plans are mutable and represent trips that are being planned.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPlans,
  deletePlan,
  PLAN_STATUS,
  PLAN_STATUS_LABELS,
} from '../../services/planService';
import CreatePlanModal from '../common/CreatePlanModal';
import PlanCard from '../common/PlanCard';
import './PlansPage.css';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'start_date', label: 'Start date' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: PLAN_STATUS.DRAFT, label: PLAN_STATUS_LABELS.draft },
  { value: PLAN_STATUS.ACTIVE, label: PLAN_STATUS_LABELS.active },
  { value: PLAN_STATUS.PROMOTED, label: PLAN_STATUS_LABELS.promoted },
  { value: PLAN_STATUS.ARCHIVED, label: PLAN_STATUS_LABELS.archived },
];

const PlansPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // State
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await getPlans(params);
      setPlans(data);
    } catch (err) {
      console.error('Failed to fetch plans:', err);
      setError('Failed to load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Filter and sort plans
  const filteredPlans = React.useMemo(() => {
    let result = [...plans];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (plan) =>
          (plan.name && plan.name.toLowerCase().includes(query)) ||
          (plan.description && plan.description.toLowerCase().includes(query)) ||
          (plan.region && plan.region.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'start_date':
          if (!a.planned_start_date) return 1;
          if (!b.planned_start_date) return -1;
          return new Date(a.planned_start_date) - new Date(b.planned_start_date);
        default:
          return 0;
      }
    });

    return result;
  }, [plans, searchQuery, sortBy]);

  // Selection handlers
  const handleSelectToggle = (planId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredPlans.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPlans.map((p) => p.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const confirmMsg =
      selectedIds.size === 1
        ? 'Delete this plan?'
        : `Delete ${selectedIds.size} plans?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await Promise.all([...selectedIds].map((id) => deletePlan(id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      fetchPlans();
    } catch (err) {
      console.error('Failed to delete plans:', err);
      setError('Failed to delete plans. Please try again.');
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Delete this plan?')) return;

    try {
      await deletePlan(planId);
      fetchPlans();
    } catch (err) {
      console.error('Failed to delete plan:', err);
      setError('Failed to delete plan. Please try again.');
    }
  };

  const handlePlanCreated = (newPlan) => {
    setShowCreateModal(false);
    navigate(`/plans/${newPlan.id}`);
  };

  // Render
  if (!isAuthenticated) {
    return (
      <div className="plans-page">
        <div className="plans-empty-state">
          <h2>Plan Your Adventures</h2>
          <p>Sign in to start creating trip plans.</p>
          <Link to="/login" className="btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="plans-page">
      {/* Toolbar */}
      <div className="plans-toolbar">
        <div className="toolbar-row primary">
          <div className="toolbar-title">
            <h1>Trip Plans</h1>
            <p>Create and manage your upcoming adventures</p>
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className={`btn-secondary ${selectMode ? 'active' : ''}`}
              onClick={() => {
                setSelectMode(!selectMode);
                setSelectedIds(new Set());
              }}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              + New Plan
            </button>
          </div>
        </div>

        <div className="toolbar-row controls">
          <div className="search-field">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="control">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="control">
            <label>Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectMode && selectedIds.size > 0 && (
          <div className="toolbar-row bulk-actions">
            <button type="button" className="btn-link" onClick={handleSelectAll}>
              {selectedIds.size === filteredPlans.length
                ? 'Deselect all'
                : 'Select all'}
            </button>
            <span className="selection-count">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              className="btn-danger"
              onClick={handleDeleteSelected}
            >
              Delete selected
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="plans-error">
          <p>{error}</p>
          <button type="button" onClick={fetchPlans}>
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="plans-loading">
          <div className="spinner" />
          <p>Loading plans...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredPlans.length === 0 && (
        <div className="plans-empty-state">
          {searchQuery || statusFilter !== 'all' ? (
            <>
              <h2>No matching plans</h2>
              <p>Try adjusting your filters or search query.</p>
            </>
          ) : (
            <>
              <h2>No plans yet</h2>
              <p>Start planning your next adventure!</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create Your First Plan
              </button>
            </>
          )}
        </div>
      )}

      {/* Plans grid */}
      {!loading && !error && filteredPlans.length > 0 && (
        <div className="plans-grid">
          {filteredPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selectMode={selectMode}
              selected={selectedIds.has(plan.id)}
              onSelectToggle={handleSelectToggle}
              onDelete={handleDeletePlan}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreatePlanModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handlePlanCreated}
        />
      )}
    </div>
  );
};

export default PlansPage;
