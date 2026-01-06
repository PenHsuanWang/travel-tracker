import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FeatureStyleEditor from './FeatureStyleEditor';

// Mock stopPropagation
const mockStopPropagation = jest.fn();

describe('FeatureStyleEditor', () => {
  const mockFeature = {
    id: 'poly-1',
    geometry: { type: 'Polygon' },
    properties: {
      name: 'Test Polygon',
      _style: {
        color: '#ff0000',
        weight: 2,
        opacity: 0.5,
        fillColor: '#00ff00',
        fillOpacity: 0.3
      }
    }
  };

  const mockOnUpdate = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnPreviewUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders polygon properties correctly', () => {
    render(
      <FeatureStyleEditor
        feature={mockFeature}
        onUpdate={mockOnUpdate}
        onClose={mockOnClose}
        onPreviewUpdate={mockOnPreviewUpdate}
        readOnly={false}
      />
    );

    expect(screen.getByDisplayValue('Test Polygon')).toBeInTheDocument();
    // Check if fill opacity slider is present
    expect(screen.getByText(/Fill Opacity/)).toBeInTheDocument();
  });

  test('calls preview update when fill opacity changes', () => {
    render(
      <FeatureStyleEditor
        feature={mockFeature}
        onUpdate={mockOnUpdate}
        onClose={mockOnClose}
        onPreviewUpdate={mockOnPreviewUpdate}
        readOnly={false}
      />
    );

    // Find the fill opacity slider
    const fillOpacitySlider = screen.getByLabelText(/Fill Opacity:/);
    
    // Change the value
    fireEvent.change(fillOpacitySlider, { target: { value: '0.5' } });

    // Verify preview update was called
    expect(mockOnPreviewUpdate).toHaveBeenCalledWith(
      'poly-1',
      expect.objectContaining({
        properties: expect.objectContaining({
          fillOpacity: 0.5
        })
      })
    );
  });

  test('updates state and saves changes with proper _style structure', () => {
    render(
      <FeatureStyleEditor
        feature={mockFeature}
        onUpdate={mockOnUpdate}
        onClose={mockOnClose}
        readOnly={false}
      />
    );

    // Change name
    const nameInput = screen.getByDisplayValue('Test Polygon');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    // Save
    fireEvent.click(screen.getByText('Save'));

    expect(mockOnUpdate).toHaveBeenCalledWith(
      'poly-1',
      expect.objectContaining({
        properties: expect.objectContaining({
          name: 'New Name',
          _style: expect.objectContaining({
              fillColor: '#00ff00',
              fillOpacity: 0.3
          })
        })
      })
    );
  });
});
