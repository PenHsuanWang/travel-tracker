/**
 * PageToolbar Component
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 5.6
 * 
 * A unified toolbar container for list pages using compound component pattern.
 * Provides consistent layout for title, search, filters, and actions.
 * 
 * @example
 * <PageToolbar>
 *   <PageToolbar.Left>
 *     <PageToolbar.Title icon={<FaHiking />}>My Trips</PageToolbar.Title>
 *   </PageToolbar.Left>
 *   <PageToolbar.Right>
 *     <SearchField value={query} onChange={setQuery} />
 *     <FilterControl label="Status" options={statusOptions} />
 *     <PageToolbar.Actions>
 *       <button className="btn btn-primary">Create Trip</button>
 *     </PageToolbar.Actions>
 *   </PageToolbar.Right>
 * </PageToolbar>
 */

import React from 'react';
import './PageToolbar.css';

/**
 * PageToolbar - Main container for page toolbar
 */
export const PageToolbar = ({ children, className = '', sticky = false }) => {
  const classNames = [
    'page-toolbar',
    sticky && 'page-toolbar--sticky',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      {children}
    </div>
  );
};

/**
 * PageToolbar.Left - Left section of toolbar
 */
PageToolbar.Left = ({ children, className = '' }) => (
  <div className={`page-toolbar__left ${className}`}>{children}</div>
);

/**
 * PageToolbar.Right - Right section of toolbar
 */
PageToolbar.Right = ({ children, className = '' }) => (
  <div className={`page-toolbar__right ${className}`}>{children}</div>
);

/**
 * PageToolbar.Title - Page title with optional icon
 */
PageToolbar.Title = ({ children, icon, className = '' }) => (
  <h1 className={`page-toolbar__title ${className}`}>
    {icon && <span className="page-toolbar__icon">{icon}</span>}
    {children}
  </h1>
);

/**
 * PageToolbar.Actions - Action buttons container
 */
PageToolbar.Actions = ({ children, className = '' }) => (
  <div className={`page-toolbar__actions ${className}`}>{children}</div>
);

/**
 * PageToolbar.Divider - Visual divider between sections
 */
PageToolbar.Divider = () => (
  <div className="page-toolbar__divider" aria-hidden="true" />
);

/**
 * PageToolbar.Group - Group related controls together
 */
PageToolbar.Group = ({ children, className = '' }) => (
  <div className={`page-toolbar__group ${className}`}>{children}</div>
);

/**
 * PageToolbar.SecondaryRow - Secondary row below main toolbar
 */
PageToolbar.SecondaryRow = ({ children, className = '' }) => (
  <div className={`page-toolbar__secondary-row ${className}`}>{children}</div>
);

export default PageToolbar;
