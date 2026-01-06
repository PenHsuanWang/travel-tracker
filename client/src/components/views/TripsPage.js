/**
 * TripsPage - Displays a list of user's trips.
 * 
 * Migrated to use unified components (Phase 4.2):
 * - PageToolbar, SearchField, FilterControl for toolbar
 * - LoadingState, EmptyState for states
 * - useListSelection, useSearchFilter hooks
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    deleteTrip,
    getTrips,
    getImageUrl,
    getImageVariantUrl,
    listImageFiles,
    updateTrip,
    uploadFile,
} from '../../services/api';
import userService from '../../services/userService';
import CreateTripModal from '../common/CreateTripModal';
import { PageToolbar } from '../common/PageToolbar';
import { SearchField } from '../common/SearchField';
import { FilterControl } from '../common/FilterControl';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { useListSelection } from '../../hooks/useListSelection';
import { useSearchFilter } from '../../hooks/useSearchFilter';
import TripCard from '../common/TripCard';
import './TripsPage.css';

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'longest', label: 'Longest distance' },
    { value: 'shortest', label: 'Shortest distance' },
    { value: 'highestElevation', label: 'Highest elevation' },
];

const defaultFilters = {
    difficulty: 'all',
    hasGpx: 'all',
    hasPhotos: 'all',
    startDate: '',
    endDate: '',
};

const normalizeDifficulty = (value) => {
    if (!value) return null;
    const lower = String(value).toLowerCase();
    if (['easy', 'moderate', 'moderate+', 'hard'].includes(lower)) return lower;
    return lower;
};

const BulkActionBar = ({
    selectedCount,
    onArchive,
    onDelete,
    onExport,
    onMerge,
    onExitSelect,
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className="bulk-bar" role="status">
            <div className="bulk-left">
                ✓ {selectedCount} {selectedCount === 1 ? 'trip' : 'trips'} selected
            </div>
            <div className="bulk-actions">
                <button type="button" className="btn btn-ghost" onClick={onArchive}>
                    Archive
                </button>
                <button type="button" className="btn btn-ghost danger" onClick={onDelete}>
                    Delete
                </button>
                <button type="button" className="btn btn-ghost" onClick={onExport}>
                    Export GPX
                </button>
                <button type="button" className="btn btn-ghost" onClick={onMerge}>
                    Merge ▾
                </button>
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onExitSelect}
                    aria-label="Exit select mode"
                >
                    Esc
                </button>
            </div>
        </div>
    );
};

const normalizePhoto = (item) => {
    if (!item) return null;
    if (typeof item === 'string') {
        return {
            key: item,
            thumb: getImageVariantUrl(item, 'preview'), // Use preview variant
            url: getImageVariantUrl(item, 'preview'), // Use preview variant
            orientation: 'unknown',
            isCover: false,
        };
    }

    const metadata = item.metadata || {};
    const objectKey = item.object_key || item.key || item.id || '';
    if (!objectKey) return null;

    // Prioritize explicit metadata URLs first, then fall back to generated variant URLs
    const thumb = metadata.thumb_url || metadata.thumbnail_url || getImageVariantUrl(objectKey, 'preview');
    const url = metadata.preview_url || getImageVariantUrl(objectKey, 'preview'); // Use preview variant for main image URL if available
    
    const width = metadata.width || metadata.image_width || null;
    const height = metadata.image_height || null;
    let orientation = 'unknown';
    if (width && height) {
        orientation = width >= height ? 'landscape' : 'portrait';
    }

    return {
        key: objectKey,
        thumb,
        url: getImageUrl(objectKey),
        orientation,
        isCover: Boolean(metadata.is_cover),
    };
};

const CoverImageModal = ({ trip, onClose, onSave }) => {
    const [photos, setPhotos] = useState([]);
    const [filter, setFilter] = useState('all');
    const [selectedKey, setSelectedKey] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    const loadPhotos = useCallback(async () => {
        if (!trip?.id) return;
        setLoading(true);
        setError(null);
        try {
            const items = await listImageFiles(trip.id);
            const normalized = (items || []).map(normalizePhoto).filter(Boolean);
            setPhotos(normalized);
        } catch (err) {
            console.error('Failed to load trip photos', err);
            setError('Unable to load photos for this trip.');
            setPhotos([]);
        } finally {
            setLoading(false);
        }
    }, [trip?.id]);

    useEffect(() => {
        if (trip) {
            loadPhotos();
            if (trip.cover_photo_id) {
                setSelectedKey(trip.cover_photo_id);
            } else if (trip.cover_image_url) {
                setSelectedKey(trip.cover_image_url);
            }
        }
    }, [trip, loadPhotos]);

    const filteredPhotos = useMemo(() => {
        if (filter === 'all') return photos;
        return photos.filter((p) => p.orientation === filter);
    }, [filter, photos]);

    if (!trip) return null;

    const handleUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || !trip?.id) return;
        setUploading(true);
        setError(null);
        try {
            await uploadFile(file, trip.id);
            await loadPhotos();
        } catch (err) {
            console.error('Upload failed', err);
            setError('Upload failed. Please try again.');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const handleSave = async () => {
        if (!selectedKey) {
            setError('Select a photo or upload a new one to use as cover.');
            return;
        }

        const isUrl = /^https?:\/\//.test(String(selectedKey));
        await onSave({
            coverKey: selectedKey,
            coverUrl: isUrl ? selectedKey : getImageUrl(selectedKey),
        });
    };

    return (
        <div className="modal-overlay cover-modal" role="dialog" aria-modal="true">
            <div className="modal-content cover-modal-content">
                <div className="modal-header">
                    <h2>{trip.cover_photo_id ? 'Change trip cover' : 'Set trip cover'}</h2>
                    <button
                        className="close-button"
                        onClick={onClose}
                        aria-label="Close cover modal"
                    >
                        &times;
                    </button>
                </div>

                <div className="cover-toolbar">
                    <div className="filter-buttons" role="group" aria-label="Filter photos">
                        <button
                            type="button"
                            className={`toggle-button ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All photos
                        </button>
                        <button
                            type="button"
                            className={`toggle-button ${filter === 'landscape' ? 'active' : ''}`}
                            onClick={() => setFilter('landscape')}
                        >
                            Landscape
                        </button>
                        <button
                            type="button"
                            className={`toggle-button ${filter === 'portrait' ? 'active' : ''}`}
                            onClick={() => setFilter('portrait')}
                        >
                            Portrait
                        </button>
                    </div>
                    <label className="upload-chip">
                        Upload new photo
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleUpload}
                            disabled={uploading}
                            aria-label="Upload new cover photo"
                        />
                    </label>
                </div>

                <div className="photo-grid">
                    {loading ? (
                        <div className="loading">Loading photos…</div>
                    ) : filteredPhotos.length === 0 ? (
                        <div className="empty-photos">No photos yet. Upload one to set it as the cover.</div>
                    ) : (
                        filteredPhotos.map((photo) => (
                            <button
                                type="button"
                                key={photo.key}
                                className={`photo-cell ${selectedKey === photo.key ? 'selected' : ''}`}
                                onClick={() => setSelectedKey(photo.key)}
                            >
                                <img src={photo.thumb} alt="Trip" />
                                {photo.isCover && <span className="photo-pill">Auto cover</span>}
                            </button>
                        ))
                    )}
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="modal-actions">
                    <button type="button" className="cancel-button" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="submit-button"
                        onClick={handleSave}
                        disabled={uploading}
                    >
                        Save as cover
                    </button>
                </div>
            </div>
        </div>
    );
};

const TripsPage = () => {
    const { isAuthenticated, user, fetchUser } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortOption, setSortOption] = useState('newest');
    const [filters, setFilters] = useState(defaultFilters);
    const [viewMode, setViewMode] = useState('grid');
    const [coverModalTrip, setCoverModalTrip] = useState(null);
    const [busyMessage, setBusyMessage] = useState('');

    const readOnly = !isAuthenticated;

    // Use unified selection hook
    const selection = useListSelection({ items: trips });

    // Custom filter function for trips
    const customFilter = useCallback((trip, filterState) => {
        // Difficulty filter
        if (filters.difficulty !== 'all') {
            if (normalizeDifficulty(trip.difficulty) !== filters.difficulty) {
                return false;
            }
        }

        // GPX filter
        if (filters.hasGpx !== 'all') {
            const hasGpx = Boolean(trip.has_gpx);
            if (filters.hasGpx === 'with' && !hasGpx) return false;
            if (filters.hasGpx === 'without' && hasGpx) return false;
        }

        // Photos filter
        if (filters.hasPhotos !== 'all') {
            const count = typeof trip.photo_count === 'number'
                ? trip.photo_count
                : Array.isArray(trip.photos) ? trip.photos.length : 0;
            if (filters.hasPhotos === 'with' && count === 0) return false;
            if (filters.hasPhotos === 'without' && count > 0) return false;
        }

        // Date range filter
        if (filters.startDate) {
            const start = new Date(filters.startDate).getTime();
            const tripStart = new Date(trip.start_date || trip.created_at || 0).getTime();
            if (tripStart < start) return false;
        }

        if (filters.endDate) {
            const end = new Date(filters.endDate).getTime();
            const tripEnd = new Date(trip.end_date || trip.start_date || trip.created_at || 0).getTime();
            if (tripEnd > end) return false;
        }

        return true;
    }, [filters]);

    // Use unified search/filter hook
    const {
        searchQuery,
        setSearchQuery,
        filteredItems: searchedTrips,
    } = useSearchFilter({
        items: trips,
        searchFields: ['name', 'title', 'region', 'location_name', 'notes'],
        debounceMs: 300,
        customFilter,
    });

    useEffect(() => {
        fetchTrips();
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (coverModalTrip) {
                    setCoverModalTrip(null);
                } else if (selection.selectMode) {
                    selection.clearSelection();
                    selection.toggleSelectMode();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [coverModalTrip, selection]);

    const fetchTrips = async () => {
        setLoading(true);
        try {
            const data = await getTrips();
            setTrips(data);
        } catch (error) {
            console.error('Failed to fetch trips:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTripCreated = (newTrip) => {
        setTrips((prev) => [newTrip, ...prev]);
    };

    const handleTogglePin = async (tripId) => {
        if (!user) return;
        
        const currentPinned = user.pinned_trip_ids || [];
        const isPinned = currentPinned.includes(tripId);
        
        let newPinned;
        if (isPinned) {
            newPinned = currentPinned.filter(id => id !== tripId);
        } else {
            if (currentPinned.length >= 3) {
                alert("You can only pin up to 3 trips.");
                return;
            }
            newPinned = [...currentPinned, tripId];
        }
        
        try {
            await userService.updateProfile({ pinned_trip_ids: newPinned });
            // Refresh user profile to update UI
            if (fetchUser) {
                await fetchUser();
            }
        } catch (error) {
            console.error("Failed to update pinned trips", error);
            alert("Failed to update pinned trips.");
        }
    };

    const handleFilterChange = (partial) => {
        setFilters((prev) => ({ ...prev, ...partial }));
    };

    // Sort the searched/filtered trips (filtering now done by useSearchFilter)
    const filteredTrips = useMemo(() => {
        const results = [...searchedTrips];

        const distanceAccessor = (trip) => Number(trip.distance_km) || 0;
        const elevationAccessor = (trip) =>
            Number(trip.highest_elevation || trip.elevation_gain || trip.elevation_m) || 0;
        const dateAccessor = (trip) =>
            new Date(trip.start_date || trip.created_at || 0).getTime();

        results.sort((a, b) => {
            switch (sortOption) {
                case 'oldest':
                    return dateAccessor(a) - dateAccessor(b);
                case 'longest':
                    return distanceAccessor(b) - distanceAccessor(a);
                case 'shortest':
                    return distanceAccessor(a) - distanceAccessor(b);
                case 'highestElevation':
                    return elevationAccessor(b) - elevationAccessor(a);
                case 'newest':
                default:
                    return dateAccessor(b) - dateAccessor(a);
            }
        });

        return results;
    }, [searchedTrips, sortOption]);

    const handleBulkDelete = async () => {
        if (selection.selectedCount === 0) return;
        const confirmed = window.confirm(
            `Delete ${selection.selectedCount} trip(s)? This cannot be undone.`
        );
        if (!confirmed) return;

        setBusyMessage('Deleting trips…');
        try {
            const idsToDelete = [...selection.selectedIds];
            await Promise.all(idsToDelete.map((id) => deleteTrip(id)));
            setTrips((prev) => prev.filter((trip) => !idsToDelete.includes(trip.id)));
            selection.clearSelection();
            selection.toggleSelectMode();
        } catch (error) {
            console.error('Failed to delete trips', error);
        } finally {
            setBusyMessage('');
        }
    };

    const handleDeleteTrip = async (tripId) => {
        const confirmDelete = window.confirm('Delete this trip? This action cannot be undone.');
        if (!confirmDelete) return;
        setBusyMessage('Deleting trip…');
        try {
            await deleteTrip(tripId);
            setTrips((prev) => prev.filter((t) => t.id !== tripId));
            selection.deselectItem(tripId);
        } catch (error) {
            console.error('Failed to delete trip', error);
            alert('Failed to delete trip. Please try again.');
        } finally {
            setBusyMessage('');
        }
    };

    const handleBulkArchive = () => {
        // TODO: API endpoint for archival once backend supports it.
        alert('Archive action will be wired to backend API.'); // eslint-disable-line no-alert
    };

    const handleBulkExport = () => {
        // TODO: API endpoint for exporting GPX in bulk.
        alert('Export GPX action will be wired to backend API.'); // eslint-disable-line no-alert
    };

    const handleMerge = () => {
        // TODO: API endpoint for merging trips.
        alert('Merge action will be wired to backend API.'); // eslint-disable-line no-alert
    };

    const handleCoverSave = async ({ coverKey, coverUrl }) => {
        if (!coverModalTrip) return;
        setBusyMessage('Updating cover image…');
        try {
            await updateTrip(coverModalTrip.id, {
                cover_photo_id: coverKey,
                cover_image_url: coverUrl,
                cover_type: 'custom',
            });
            setTrips((prev) =>
                prev.map((trip) =>
                    trip.id === coverModalTrip.id
                        ? { ...trip, cover_photo_id: coverKey, cover_image_url: coverUrl, cover_type: 'custom' }
                        : trip
                )
            );
            setCoverModalTrip(null);
        } catch (error) {
            console.error('Failed to update cover image', error);
        } finally {
            setBusyMessage('');
        }
    };

    const handleImport = () => {
        alert('Import flow coming soon.'); // eslint-disable-line no-alert
    };

    return (
        <div className="trips-page">
            <PageToolbar>
                <PageToolbar.Left>
                    <PageToolbar.Title title="My Trips" subtitle="Manage your hiking journal, covers, and bulk actions in one place." />
                </PageToolbar.Left>
                <PageToolbar.Right>
                    <PageToolbar.Actions>
                        {!readOnly && (
                            <>
                                <button 
                                    type="button" 
                                    className={`btn btn-secondary ${selection.selectMode ? 'active' : ''}`}
                                    onClick={selection.toggleSelectMode}
                                >
                                    {selection.selectMode ? 'Cancel' : 'Select'}
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={handleImport}>
                                    ⬇ Import
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => setIsModalOpen(true)}
                                >
                                    + New Trip
                                </button>
                            </>
                        )}
                    </PageToolbar.Actions>
                </PageToolbar.Right>
                <PageToolbar.SecondaryRow>
                    <SearchField 
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search trips by name, location or notes…"
                    />
                    
                    <FilterControl 
                         type="dropdown"
                         label="Sort"
                         value={sortOption}
                         options={SORT_OPTIONS}
                         onChange={setSortOption}
                    />
                    
                    <FilterControl 
                        type="dropdown"
                        label="Difficulty"
                        value={filters.difficulty}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'easy', label: 'Easy' },
                            { value: 'moderate', label: 'Moderate' },
                            { value: 'hard', label: 'Hard' },
                        ]}
                        onChange={(val) => handleFilterChange({ difficulty: val })}
                    />
                    
                     <FilterControl 
                        type="dropdown"
                        label="GPX"
                        value={filters.hasGpx}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'with', label: 'Has GPX' },
                            { value: 'without', label: 'No GPX' },
                        ]}
                        onChange={(val) => handleFilterChange({ hasGpx: val })}
                    />
                    
                    <FilterControl 
                        type="dropdown"
                        label="Photos"
                        value={filters.hasPhotos}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'with', label: 'Has photos' },
                            { value: 'without', label: 'No photos' },
                        ]}
                        onChange={(val) => handleFilterChange({ hasPhotos: val })}
                    />
                    
                    {/* Date filters would need a custom date range component or individual inputs, for now standard inputs */}
                    <div className="filter-group">
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => handleFilterChange({ startDate: e.target.value })}
                            className="form-input"
                            aria-label="Filter start date from"
                            style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                        />
                         <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => handleFilterChange({ endDate: e.target.value })}
                            className="form-input"
                            aria-label="Filter end date to"
                            style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                        />
                    </div>

                    <div className="view-toggle" role="group" aria-label="Toggle view mode" style={{ marginLeft: 'auto' }}>
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('grid')}
                            aria-pressed={viewMode === 'grid'}
                        >
                            ☷ Grid
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('list')}
                            aria-pressed={viewMode === 'list'}
                        >
                            ☰ List
                        </button>
                    </div>
                </PageToolbar.SecondaryRow>
                
                 {/* Bulk actions bar when items selected */}
                {selection.selectMode && selection.selectedCount > 0 && (
                  <PageToolbar.SecondaryRow className="bulk-actions">
                    <button
                      type="button"
                      className="btn btn-link"
                      onClick={() => selection.selectAll(filteredTrips)}
                    >
                      {selection.allSelected ? 'Deselect all' : 'Select all'}
                    </button>
                    <span className="selection-count">
                      {selection.selectedCount} selected
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleBulkDelete}
                    >
                      Delete selected
                    </button>
                  </PageToolbar.SecondaryRow>
                )}
            </PageToolbar>

            {busyMessage && <div className="inline-status">{busyMessage}</div>}

            {loading ? (
                <LoadingState message="Loading trips…" />
            ) : filteredTrips.length === 0 ? (
                <EmptyState
                    icon="🥾"
                    title="You don't have any trips yet"
                    description="Create a trip, upload your GPX track and photos to start your hiking journal."
                    action={!readOnly && (
                        <div className="empty-actions">
                            <button type="button" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                                + Create your first trip
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={handleImport}>
                                Import GPX history
                            </button>
                        </div>
                    )}
                />
            ) : (
                <div
                    className={`trips-grid ${
                        viewMode === 'list' ? 'list-mode' : ''
                    }`}
                >
                    {filteredTrips.map((trip) => (
                        <TripCard
                            key={trip.id}
                            trip={trip}
                            viewMode={viewMode}
                            selectMode={selection.selectMode}
                            selected={selection.isSelected(trip.id)}
                            onSelectToggle={selection.toggleItem}
                            onOpenCover={setCoverModalTrip}
                            onDelete={handleDeleteTrip}
                            readOnly={readOnly}
                            isPinned={user?.pinned_trip_ids?.includes(trip.id)}
                            onTogglePin={handleTogglePin}
                            currentUserId={user?.id}
                        />
                    ))}
                </div>
            )}

            <CreateTripModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onTripCreated={handleTripCreated}
            />

            {coverModalTrip && (
                <CoverImageModal
                    trip={coverModalTrip}
                    onClose={() => setCoverModalTrip(null)}
                    onSave={handleCoverSave}
                />
            )}
        </div>
    );
};

export default TripsPage;
