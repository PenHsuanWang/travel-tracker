import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoTimelinePanel from '../PhotoTimelinePanel';

jest.mock('react-markdown', () => ({ children }) => <>{children}</>);
jest.mock('../../annotations/QuickAnnotationBar', () => () => <div data-testid="quick-annotation-bar" />);

window.HTMLElement.prototype.scrollIntoView = jest.fn();

const basePhoto = {
  id: 'photo-1',
  type: 'photo',
  note: 'Existing note',
  noteTitle: 'Existing note',
  capturedDate: new Date('2024-01-02T03:04:05Z'),
  imageUrl: 'https://example.com/full.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  metadataId: 'meta-1',
};

const renderPanel = (overrideProps = {}) => {
  const props = {
    photos: [basePhoto],
    selectedPhotoId: null,
    onSelectPhoto: jest.fn(),
    onEditNote: jest.fn(),
    onOpenAnnotations: jest.fn(),
    onQuickAnnotate: jest.fn(),
    quickSavingMap: {},
    selectionMode: false,
    selectedForBulk: [],
    onToggleSelect: jest.fn(),
    onSelectionModeChange: jest.fn(),
    onRequestBulkEdit: jest.fn(),
    isOpen: true,
    mode: 'side',
    loading: false,
    ...overrideProps,
  };

  render(<PhotoTimelinePanel {...props} />);
  return props;
};

describe('PhotoTimelinePanel interactions', () => {
  it('does not open image viewer when interacting with the note editor', () => {
    const props = renderPanel();

    fireEvent.click(screen.getAllByLabelText(/edit note for/i)[0]);
    const textarea = screen.getByPlaceholderText(/Add a note about this moment/i);

    fireEvent.click(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    fireEvent.keyDown(textarea, { key: ' ' });

    expect(props.onSelectPhoto).not.toHaveBeenCalled();
  });

  it('still opens the viewer when the row is clicked directly', () => {
    const props = renderPanel();

    const row = document.querySelector('.timeline-row');
    expect(row).toBeTruthy();

    fireEvent.click(row);

    expect(props.onSelectPhoto).toHaveBeenCalledTimes(1);
    expect(props.onSelectPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: basePhoto.id }));
  });
});
