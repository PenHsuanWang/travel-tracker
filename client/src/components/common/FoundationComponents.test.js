/**
 * Phase 1 Foundation Components Tests
 * 
 * Tests for StatusBadge, EmptyState, and LoadingState components
 * created as part of the Frontend Unification initiative.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

// ═══════════════════════════════════════════════════════════
// StatusBadge Tests
// ═══════════════════════════════════════════════════════════

describe('StatusBadge', () => {
  test('renders with default status label', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('renders with custom label', () => {
    render(<StatusBadge status="active" label="In Progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  test('applies correct CSS classes for status', () => {
    const { container } = render(<StatusBadge status="draft" />);
    const badge = container.querySelector('.status-badge');
    expect(badge).toHaveClass('status-badge--gray');
  });

  test('applies size variant class', () => {
    const { container } = render(<StatusBadge status="active" size="md" />);
    const badge = container.querySelector('.status-badge');
    expect(badge).toHaveClass('status-badge--md');
  });

  test('applies variant class', () => {
    const { container } = render(<StatusBadge status="active" variant="outline" />);
    const badge = container.querySelector('.status-badge');
    expect(badge).toHaveClass('status-badge--outline');
  });

  test('handles unknown status gracefully', () => {
    render(<StatusBadge status="unknown-status" />);
    expect(screen.getByText('unknown-status')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════
// EmptyState Tests
// ═══════════════════════════════════════════════════════════

describe('EmptyState', () => {
  test('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  test('renders description when provided', () => {
    render(
      <EmptyState 
        title="No items" 
        description="Create your first item to get started" 
      />
    );
    expect(screen.getByText('Create your first item to get started')).toBeInTheDocument();
  });

  test('renders icon when provided', () => {
    const { container } = render(
      <EmptyState 
        title="No items" 
        icon={<span data-testid="test-icon">🎒</span>} 
      />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(container.querySelector('.empty-state__icon')).toBeInTheDocument();
  });

  test('renders action when provided', () => {
    render(
      <EmptyState 
        title="No items" 
        action={<button>Create Item</button>} 
      />
    );
    expect(screen.getByRole('button', { name: 'Create Item' })).toBeInTheDocument();
  });

  test('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="No items" />);
    expect(container.querySelector('.empty-state__description')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════
// LoadingState Tests
// ═══════════════════════════════════════════════════════════

describe('LoadingState', () => {
  test('renders with default message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders with custom message', () => {
    render(<LoadingState message="Fetching trips..." />);
    expect(screen.getByText('Fetching trips...')).toBeInTheDocument();
  });

  test('renders spinner', () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector('.loading-state__spinner')).toBeInTheDocument();
  });

  test('applies size variant class', () => {
    const { container } = render(<LoadingState size="lg" />);
    const loadingState = container.querySelector('.loading-state');
    expect(loadingState).toHaveClass('loading-state--lg');
  });

  test('does not render message when set to empty string', () => {
    const { container } = render(<LoadingState message="" />);
    expect(container.querySelector('.loading-state__message')).not.toBeInTheDocument();
  });
});
