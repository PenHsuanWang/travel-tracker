// client/src/components/common/PlanCard.js
/**
 * PlanCard - Displays a single plan in the plans grid.
 * 
 * Shows plan metadata, status badge, and action buttons.
 * Uses the unified Card compound component.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { PLAN_STATUS_LABELS } from '../../services/planService';
import { Card, CardBody, CardFooter, CardTitle, CardCover } from './Card/Card';
import StatusBadge from './StatusBadge';
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
    <Card
      variant="plan"
      className="plan-card"
      selected={selected}
      onClick={handleCardClick}
      hoverable={true}
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
          <span className="checkbox-visual" aria-hidden="true" />
        </label>
      )}

      {/* Cover Area (Placeholder 16:9) */}
      <CardCover className="cover-area" aspectRatio="16/9">
        <div className="cover-placeholder" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <div className="placeholder-icon">📋</div>
        </div>

        <div className="cover-overlay">
          <div className="cover-actions" style={{ justifyContent: 'flex-end' }}>
            <StatusBadge status={plan.status} label={PLAN_STATUS_LABELS[plan.status]} />
          </div>
        </div>
      </CardCover>

      {/* Content */}
      <CardBody>
        {/* Title Row: Title + Date */}
        <div className="plan-title-row">
          <CardTitle>
            {!selectMode ? (
              <Link
                to={`/plans/${plan.id}`}
                className="plan-name-link"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {plan.name || 'Untitled Plan'}
              </Link>
            ) : (
              plan.name || 'Untitled Plan'
            )}
          </CardTitle>
          <div className="plan-date">
            {formatDateRange(plan.planned_start_date, plan.planned_end_date)}
          </div>
        </div>

        {/* Owner Info */}
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

        {/* Stats / Meta Pills */}
        <div className="plan-meta-row">
          <span className="meta-pill">
            📍 {featureCount} {featureCount === 1 ? 'Feature' : 'Features'}
          </span>
          <span className="meta-pill">
            🧭 {trackCount} {trackCount === 1 ? 'Track' : 'Tracks'}
          </span>
        </div>
      </CardBody>

      {/* Actions */}
      {!selectMode && (
        <CardFooter>
          <div className="plan-card-actions" style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <Link to={`/plans/${plan.id}`} className="btn btn-primary btn-sm">
              {canEdit ? 'Edit' : 'View'}
            </Link>
            
            <div style={{ flex: '1 1 0%' }}></div>

            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-sm danger"
                title="Delete Plan"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(plan.id);
                }}
              >
                🗑
              </button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default PlanCard;
