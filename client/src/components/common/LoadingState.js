/**
 * LoadingState Component
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 5.8
 * 
 * A unified loading spinner component for displaying loading states
 * across Trip and Plan contexts. Automatically adapts to theme colors.
 * 
 * @example
 * {loading && <LoadingState message="Loading trips..." />}
 * <LoadingState size="sm" />
 * <LoadingState size="lg" message="Please wait..." />
 */

import React from 'react';
import './LoadingState.css';

/**
 * LoadingState - Displays a centered loading spinner with optional message
 * 
 * @param {Object} props
 * @param {string} [props.message='Loading...'] - Message to display below spinner
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant
 * @param {string} [props.className] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export const LoadingState = ({ 
  message = 'Loading...', 
  size = 'md',
  className = '' 
}) => {
  const classNames = [
    'loading-state',
    `loading-state--${size}`,
    className,
  ].filter(Boolean).join(' ');
  
  return (
    <div className={classNames}>
      <div className="loading-state__spinner" aria-hidden="true" />
      {message && <p className="loading-state__message">{message}</p>}
    </div>
  );
};

export default LoadingState;
