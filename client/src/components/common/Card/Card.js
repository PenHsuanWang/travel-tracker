/**
 * Card Compound Component System
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 5.3
 * 
 * A flexible card component system using the compound component pattern.
 * Provides shared container styling with flexible internal composition.
 * 
 * @example
 * <Card variant="trip" selected={isSelected}>
 *   <CardCover>
 *     <img src={coverUrl} alt={title} />
 *   </CardCover>
 *   <CardBody>
 *     <h3>{title}</h3>
 *     <p>{description}</p>
 *   </CardBody>
 *   <CardFooter>
 *     <button>View Details</button>
 *   </CardFooter>
 * </Card>
 */

import React from 'react';
import './Card.css';

/**
 * Card - Container wrapper for card content
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {'trip'|'plan'} [props.variant] - Theme variant
 * @param {boolean} [props.selected=false] - Whether card is selected
 * @param {boolean} [props.hoverable=true] - Whether card has hover effect
 * @param {Function} [props.onClick] - Click handler
 * @param {string} [props.className] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export const Card = ({ 
  children, 
  variant, 
  selected = false,
  hoverable = true,
  onClick,
  className = '',
  ...props 
}) => {
  const classNames = [
    'card',
    variant && `card--${variant}`,
    selected && 'card--selected',
    hoverable && 'card--hoverable',
    onClick && 'card--clickable',
    className,
  ].filter(Boolean).join(' ');

  return (
    <article
      className={classNames}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
      {...props}
    >
      {children}
    </article>
  );
};

/**
 * CardHeader - Top section of the card, typically for badges or status
 */
export const CardHeader = ({ children, className = '' }) => (
  <div className={`card__header ${className}`}>{children}</div>
);

/**
 * CardBody - Main content area of the card
 */
export const CardBody = ({ children, className = '' }) => (
  <div className={`card__body ${className}`}>{children}</div>
);

/**
 * CardFooter - Bottom section for actions
 */
export const CardFooter = ({ children, className = '' }) => (
  <div className={`card__footer ${className}`}>{children}</div>
);

/**
 * CardCover - Image cover area with aspect ratio
 */
export const CardCover = ({ children, className = '', aspectRatio = '16/9' }) => (
  <div 
    className={`card__cover ${className}`}
    style={{ aspectRatio }}
  >
    {children}
  </div>
);

/**
 * CardTitle - Styled title element
 */
export const CardTitle = ({ children, className = '', as: Component = 'h3' }) => (
  <Component className={`card__title ${className}`}>{children}</Component>
);

/**
 * CardMeta - Secondary information row
 */
export const CardMeta = ({ children, className = '' }) => (
  <div className={`card__meta ${className}`}>{children}</div>
);

/**
 * CardActions - Action buttons container (for selection checkbox, menu, etc.)
 */
export const CardActions = ({ children, className = '' }) => (
  <div className={`card__actions ${className}`}>{children}</div>
);

// Default export as namespace object for convenience
const CardNamespace = {
  Root: Card,
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
  Cover: CardCover,
  Title: CardTitle,
  Meta: CardMeta,
  Actions: CardActions,
};

export default CardNamespace;
