// client/src/components/common/PlanCard.js
/**
 * PlanCard - Displays a single plan in the plans grid.
 * 
 * Shows plan metadata, status badge, and action buttons.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { PLAN_STATUS_LABELS } from '../../services/planService';
import './PlanCard.css';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateRange = (start, end) => {
  const startText = formatDate(start);
  const endText = formatDate(end);
  if (startText && endText) return `${startText} – ${endText}`;
  return startText || endText || '—';
};

const getStatusClass = (status) => {
  switch (status) {
    case 'draft':
      return 'status-draft';
    case 'active':
      return 'status-active';
    case 'promoted':
      return 'status-promoted';
    case 'archived':
      return 'status-archived';
    default:
      return '';
  }
};

const PlanCard = ({
  plan,
  selectMode,
  selected,
  onSelectToggle,
  onDelete,
  currentUserId,
}) => {
  const isOwner = currentUserId && plan.owner_id === currentUserId;
  const canEdit = isOwner;
  // Handle features being a FeatureCollection object or array
  const getFeaturesArray = () => {
    if (!plan.features) return [];
    if (Array.isArray(plan.features)) return plan.features;
    return plan.features.features || [];
  };
  const featureCount = getFeaturesArray().length;
  const trackCount = plan.reference_tracks?.length || 0;

  const handleCardClick = (e) => {
    if (selectMode) {
      e.preventDefault();
      onSelectToggle(plan.id);
    }
  };

  return (
    <article
      className={`plan-card ${selected ? 'is-selected' : ''}`}
      onClick={handleCardClick}
      tabIndex={0}
      role="group"
      aria-label={`Plan ${plan.name || 'Untitled plan'}`}
    >
      {/* Selection checkbox */}
      {selectMode && (
        <label className="plan-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelectToggle(plan.id)}
            aria-label={`Select ${plan.name || ''}`}
          />
          <span className="checkbox-visual" aria-hidden />
        </label>
      )}

      {/* Header */}
      <div className="plan-card-header">
        <div className="plan-icon">📋</div>
        <span className={`plan-status-badge ${getStatusClass(plan.status)}`}>
          {PLAN_STATUS_LABELS[plan.status] || plan.status}
        </span>
      </div>

      {/* Content */}
      <div className="plan-card-content">
        <Link
          to={`/plans/${plan.id}`}
          className="plan-name-link"
          onClick={(e) => selectMode && e.preventDefault()}
        >
          <h3 className="plan-name">{plan.name || 'Untitled Plan'}</h3>
        </Link>

        {plan.description && (
          <p className="plan-description">{plan.description}</p>
        )}

        {plan.region && (
          <div className="plan-region">
            <span className="region-icon">📍</span>
            {plan.region}
          </div>
        )}

        <div className="plan-dates">
          <span className="dates-icon">📅</span>
          {formatDateRange(plan.planned_start_date, plan.planned_end_date)}
        </div>

        {/* Stats */}
        <div className="plan-stats">
          <div className="stat">
            <span className="stat-value">{featureCount}</span>
            <span className="stat-label">{featureCount === 1 ? 'Feature' : 'Features'}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{trackCount}</span>
            <span className="stat-label">{trackCount === 1 ? 'Track' : 'Tracks'}</span>
          </div>
        </div>

        {/* Owner info */}
        {plan.owner && (
          <div className="plan-owner">
            <span className="owner-avatar">
              {plan.owner.avatar_url ? (
                <img src={plan.owner.avatar_url} alt={plan.owner.username} />
              ) : (
                plan.owner.username?.charAt(0).toUpperCase() || '?'
              )}
            </span>
            <span className="owner-name">{plan.owner.username}</span>
            {isOwner && <span className="owner-badge">Owner</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      {!selectMode && (
        <div className="plan-card-actions">
          <Link to={`/plans/${plan.id}`} className="btn-card-action primary">
            {canEdit ? 'Edit' : 'View'}
          </Link>
          {canEdit && (
            <button
              type="button"
              className="btn-card-action danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(plan.id);
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default PlanCard;
