/**
 * StatusBadge Component
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 5.4
 * 
 * A unified status badge component for displaying status labels across
 * Trip and Plan contexts. Automatically adapts to theme context.
 * 
 * @example
 * <StatusBadge status="active" />
 * <StatusBadge status="draft" variant="outline" />
 * <StatusBadge status="completed" size="md" />
 */

import React from 'react';
import './StatusBadge.css';

const STATUS_VARIANTS = {
  draft: { label: 'Draft', color: 'gray' },
  active: { label: 'Active', color: 'brand' },
  archived: { label: 'Archived', color: 'warning' },
  completed: { label: 'Completed', color: 'success' },
  pending: { label: 'Pending', color: 'warning' },
  cancelled: { label: 'Cancelled', color: 'danger' },
};

/**
 * StatusBadge - Displays a styled status indicator
 * 
 * @param {Object} props
 * @param {string} props.status - Status key (draft, active, archived, completed, pending, cancelled)
 * @param {'solid'|'outline'} [props.variant='solid'] - Visual variant
 * @param {'sm'|'md'} [props.size='sm'] - Size variant
 * @param {string} [props.label] - Override default label
 * @param {string} [props.className] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export const StatusBadge = ({ 
  status, 
  variant = 'solid',
  size = 'sm',
  label,
  className = '',
}) => {
  const config = STATUS_VARIANTS[status] || { label: status, color: 'gray' };
  const displayLabel = label || config.label;
  
  const classNames = [
    'status-badge',
    `status-badge--${config.color}`,
    `status-badge--${variant}`,
    `status-badge--${size}`,
    className,
  ].filter(Boolean).join(' ');
  
  return (
    <span className={classNames}>
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
