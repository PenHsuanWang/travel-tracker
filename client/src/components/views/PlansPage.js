// client/src/components/views/PlansPage.js
/**
 * PlansPage - Displays a list of user's trip plans.
 * 
 * This component follows the same patterns as TripsPage but for the Plan entity.
 * Plans are mutable and represent trips that are being planned.
 * 
 * Migrated to use unified components (Phase 4.1):
 * - PageToolbar, SearchField, FilterControl for toolbar
 * - LoadingState, EmptyState for states
 * - useListSelection, useSearchFilter hooks
 */
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPlans,
  deletePlan,
  PLAN_STATUS,
  PLAN_STATUS_LABELS,
} from '../../services/planService';
import CreatePlanModal from '../common/CreatePlanModal';
import ImportGpxModal from '../common/ImportGpxModal';
import PlanCard from '../common/PlanCard';
import { PageToolbar } from '../common/PageToolbar';
import { SearchField } from '../common/SearchField';
import { FilterControl } from '../common/FilterControl';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { useListSelection } from '../../hooks/useListSelection';
import { useSearchFilter } from '../../hooks/useSearchFilter';
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
  { value: PLAN_STATUS.ARCHIVED, label: PLAN_STATUS_LABELS.archived },
];

const PlansPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Core state
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportGpxModal, setShowImportGpxModal] = useState(false);

  // Use unified selection hook
  const selection = useListSelection({ items: plans });

  // Custom filter function for status and sort
  const customFilter = useCallback((item, filters) => {
    return true; // Status filter handled by API
  }, []);

  // Use unified search/filter hook
  const {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    filteredItems: searchedPlans,
  } = useSearchFilter({
    items: plans,
    searchFields: ['name', 'description', 'region'],
    debounceMs: 300,
    customFilter,
  });

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

  // Sort filtered plans
  const filteredPlans = useMemo(() => {
    const result = [...searchedPlans];

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
  }, [searchedPlans, sortBy]);


  // Bulk delete handler using selection hook
  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    const confirmMsg =
      selection.selectedCount === 1
        ? 'Delete this plan?'
        : `Delete ${selection.selectedCount} plans?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await Promise.all([...selection.selectedIds].map((id) => deletePlan(id)));
      selection.clearSelection();
      selection.toggleSelectMode();
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

  // Render - Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="plans-page">
        <EmptyState
          icon="🗺️"
          title="Plan Your Adventures"
          description="Sign in to start creating trip plans."
          action={
            <Link to="/login" className="btn btn-primary">
              Sign In
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="plans-page">
      {/* Unified Toolbar using PageToolbar compound component */}
      <PageToolbar>
        <PageToolbar.Left>
          <PageToolbar.Title
            title="Trip Plans"
            subtitle="Create and manage your upcoming adventures"
          />
        </PageToolbar.Left>

        <PageToolbar.Right>
          <PageToolbar.Actions>
            <button
              type="button"
              className={`btn btn-secondary ${selection.selectMode ? 'active' : ''}`}
              onClick={selection.toggleSelectMode}
            >
              {selection.selectMode ? 'Cancel' : 'Select'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowImportGpxModal(true)}
              title="Import GPX file to create a plan"
            >
              📂 Import GPX
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              + New Plan
            </button>
          </PageToolbar.Actions>
        </PageToolbar.Right>

        <PageToolbar.SecondaryRow>
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search plans..."
          />

          <FilterControl
            type="dropdown"
            label="Status"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
          />

          <FilterControl
            type="dropdown"
            label="Sort by"
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={setSortBy}
          />
        </PageToolbar.SecondaryRow>

        {/* Bulk actions bar when items selected */}
        {selection.selectMode && selection.selectedCount > 0 && (
          <PageToolbar.SecondaryRow className="bulk-actions">
            <button
              type="button"
              className="btn btn-link"
              onClick={() => selection.selectAll(filteredPlans)}
            >
              {selection.allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <span className="selection-count">
              {selection.selectedCount} selected
            </span>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDeleteSelected}
            >
              Delete selected
            </button>
          </PageToolbar.SecondaryRow>
        )}
      </PageToolbar>

      {/* Error message */}
      {error && (
        <div className="plans-error">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={fetchPlans}>
            Retry
          </button>
        </div>
      )}

      {/* Loading state - using unified component */}
      {loading && <LoadingState message="Loading plans..." />}

      {/* Empty state - using unified component */}
      {!loading && !error && filteredPlans.length === 0 && (
        searchQuery || statusFilter !== 'all' ? (
          <EmptyState
            icon="🔍"
            title="No matching plans"
            description="Try adjusting your filters or search query."
          />
        ) : (
          <EmptyState
            icon="📋"
            title="No plans yet"
            description="Start planning your next adventure!"
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create Your First Plan
              </button>
            }
          />
        )
      )}

      {/* Plans grid */}
      {!loading && !error && filteredPlans.length > 0 && (
        <div className="plans-grid">
          {filteredPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selectMode={selection.selectMode}
              selected={selection.isSelected(plan.id)}
              onSelectToggle={selection.toggleItem}
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

      {/* Import GPX modal */}
      {showImportGpxModal && (
        <ImportGpxModal
          onClose={() => setShowImportGpxModal(false)}
          onCreated={handlePlanCreated}
        />
      )}
    </div>
  );
};

export default PlansPage;
