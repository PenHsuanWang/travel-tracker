import React from 'react';
import { Camera, MapPin, PenLine, Link as LinkIcon } from 'lucide-react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-markdown since it's ESM only and fails in Jest
jest.mock('react-markdown', () => ({ children }) => <div data-testid="markdown">{children}</div>);

import TimelinePanel from './TimelinePanel';

const mockItems = [
    {
        id: '1',
        type: 'photo',
        timestamp: 1672531200000, // 2023-01-01 08:00:00
        title: 'Sunrise',
        imageUrl: 'https://example.com/sunrise.jpg',
        note: 'Beautiful sunrise',
    },
    {
        id: '2',
        type: 'waypoint',
        timestamp: 1672534800000, // 2023-01-01 09:00:00
        elevation: 1200,
        note: 'Reached the peak',
    },
];

test('renders TimelinePanel with items', () => {
    render(
        <TimelinePanel
            items={mockItems}
            onAddPhoto={() => { }}
            onAddUrl={() => { }}
            onUpdateItem={() => { }}
            onDeleteItem={() => { }}
            onItemClick={() => { }}
        />
    );

    expect(screen.getByText('Memories')).toBeInTheDocument();
    expect(screen.getByText('Journey Log')).toBeInTheDocument();
    expect(screen.getByText('Sunrise')).toBeInTheDocument();
    expect(screen.getByText('Waypoint')).toBeInTheDocument();
    expect(screen.getByText('Beautiful sunrise')).toBeInTheDocument();
});

test('toggles edit mode', () => {
    render(
        <TimelinePanel
            items={mockItems}
            onAddPhoto={() => { }}
            onAddUrl={() => { }}
            onUpdateItem={() => { }}
            onDeleteItem={() => { }}
            onItemClick={() => { }}
        />
    );

    const editButtons = screen.getAllByLabelText('Edit item');
    fireEvent.click(editButtons[0]);

    expect(screen.getByDisplayValue('Sunrise')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
});
