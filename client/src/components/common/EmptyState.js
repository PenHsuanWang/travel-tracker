/**
 * EmptyState Component
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 5.7
 * 
 * A unified empty state display component for showing placeholder content
 * when lists are empty. Supports icon, title, description, and action button.
 * 
 * @example
 * <EmptyState
 *   icon={<FaHiking />}
 *   title="No trips yet"
 *   description="Start your adventure by creating your first trip!"
 *   action={<button className="btn btn-primary">Create Trip</button>}
 * />
 */

import React from 'react';
import './EmptyState.css';

/**
 * EmptyState - Displays a centered empty state message
 * 
 * @param {Object} props
 * @param {React.ReactNode} [props.icon] - Icon element to display
 * @param {string} props.title - Main heading text
 * @param {string} [props.description] - Secondary description text
 * @param {React.ReactNode} [props.action] - Action button or link
 * @param {string} [props.className] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export const EmptyState = ({ 
  icon, 
  title, 
  description, 
  action,
  className = '' 
}) => {
  const classNames = ['empty-state', className].filter(Boolean).join(' ');
  
  return (
    <div className={classNames}>
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
};

export default EmptyState;
