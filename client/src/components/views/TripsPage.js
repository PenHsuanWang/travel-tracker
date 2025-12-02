import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    deleteTrip,
    getTrips,
    getImageUrl,
    listImageFiles,
    updateTrip,
    uploadFile,
} from '../../services/api';
import userService from '../../services/userService';
import CreateTripModal from '../common/CreateTripModal';
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

const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
};

const formatDateRange = (start, end) => {
    const startText = formatDate(start);
    const endText = formatDate(end);
    if (startText && endText) return `${startText} – ${endText}`;
    return startText || endText || '—';
};

const normalizeDifficulty = (value) => {
    if (!value) return null;
    const lower = String(value).toLowerCase();
    if (['easy', 'moderate', 'moderate+', 'hard'].includes(lower)) return lower;
    return lower;
};

const TripCard = ({
    trip,
    viewMode,
    selectMode,
    selected,
    onSelectToggle,
    onOpenCover,
    onDelete,
    readOnly,
    isPinned,
    onTogglePin
}) => {
    const coverUrl =
        trip.cover_image_url ||
        (trip.cover_photo_id ? getImageUrl(trip.cover_photo_id) : null);
    const hasCover = Boolean(coverUrl);
    const distanceLabel = trip.distance_km ? `${trip.distance_km} km` : '—';
    const difficulty = normalizeDifficulty(trip.difficulty);
    const difficultyLabel = difficulty
        ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
        : 'Not set';
    const gpxLabel = trip.has_gpx ? '✓' : '–';
    const photosLabel =
        typeof trip.photo_count === 'number' ? trip.photo_count : '—';
    const owner = trip.owner;

    const handleCardClick = () => {
        if (selectMode) {
            onSelectToggle(trip.id);
        }
    };

    return (
        <article
            className={`trip-card ${viewMode === 'list' ? 'list-view' : ''} ${
                selected ? 'is-selected' : ''
            }`}
            onClick={handleCardClick}
            tabIndex={0}
            role="group"
            aria-label={`Trip ${trip.name || trip.title || 'Untitled trip'}`}
        >
            {selectMode && (
                <label
                    className="trip-checkbox"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onSelectToggle(trip.id)}
                        aria-label={`Select ${trip.name || trip.title || ''}`}
                    />
                    <span className="checkbox-visual" aria-hidden />
                </label>
            )}

            <div className="cover-area">
                {hasCover ? (
                    <img
                        src={coverUrl}
                        alt={`${trip.name || 'Trip'} cover`}
                        className="cover-image"
                    />
                ) : (
                    <div className="cover-placeholder">
                        <div className="placeholder-icon">⛰</div>
                        <div className="placeholder-text">Add cover image</div>
                    </div>
                )}

                {!readOnly && (
                    <div className="cover-overlay">
                        {trip.cover_type && (
                            <span className="cover-pill">
                                {trip.cover_type === 'custom' ? 'Custom cover' : 'Auto cover'}
                            </span>
                        )}
                        <div className="cover-actions">
                            <button
                                type="button"
                                className="ghost-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenCover(trip);
                                }}
                            >
                                {hasCover ? 'Change cover' : 'Add cover image'}
                            </button>
                            {hasCover && (
                                <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenCover(trip);
                                    }}
                                >
                                    Choose from photos
                                </button>
                            )}
                            <button
                                type="button"
                                className={`ghost-button ghost-icon ${isPinned ? 'pinned' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePin(trip.id);
                                }}
                                title={isPinned ? "Unpin from profile" : "Pin to profile"}
                            >
                                {isPinned ? '★' : '☆'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="trip-body">
                <div className="trip-title-row">
                    <div className="trip-title">
                        {trip.name || trip.title || 'Untitled trip'}
                    </div>
                    {owner && (
                        <div className="trip-owner">
                            <img 
                                src={owner.avatar_url ? (owner.avatar_url.startsWith('http') ? owner.avatar_url : getImageUrl(owner.avatar_url)) : '/default-avatar.svg'} 
                                alt={owner.username} 
                                className="owner-avatar-small" 
                                title={`Owner: ${owner.username}`}
                            />
                            <span className="owner-name">{owner.username}</span>
                        </div>
                    )}
                    <div className="trip-date">
                        {formatDateRange(trip.start_date, trip.end_date)}
                    </div>
                </div>

                <div className="trip-meta-row">
                    <span className="meta-pill">
                        📍 {trip.region || trip.location_name || 'Not set'}
                    </span>
                    <span className="meta-pill">
                        ⛰ {difficultyLabel}
                    </span>
                    <span className="meta-pill">🚶 {distanceLabel}</span>
                </div>

                <div className="trip-status-row">
                    <span className="status">
                        🛰 GPX: <strong>{gpxLabel}</strong>
                    </span>
                    <span className="status">
                        📷 Photos: <strong>{photosLabel}</strong>
                    </span>
                </div>

                <div className="trip-actions">
                    <Link
                        to={`/trips/${trip.id}`}
                        className="primary-link"
                        onClick={(e) => e.stopPropagation()}
                    >
                        View Trip
                    </Link>
                    <Link
                        to={`/trips/${trip.id}`}
                        state={{ focus: 'map' }}
                        className="ghost-button"
                        onClick={(e) => e.stopPropagation()}
                    >
                        Open Map
                    </Link>
                    {!readOnly && (
                        <button
                            type="button"
                            className="ghost-button danger"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.(trip.id);
                            }}
                        >
                            Delete
                        </button>
                    )}
                    {!readOnly && (
                        <button
                            type="button"
                            className="ghost-button ghost-icon"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="More trip actions"
                        >
                            ⋯
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
};

const TripsToolbar = ({
    searchQuery,
    onSearchChange,
    sortOption,
    onSortChange,
    filters,
    onFilterChange,
    onNewTrip,
    onImport,
    selectMode,
    onToggleSelectMode,
    viewMode,
    onViewModeChange,
    readOnly,
}) => {
    return (
        <div className="trips-toolbar">
            <div className="toolbar-row primary">
                <div className="toolbar-title">
                    <h1>My Trips</h1>
                    <p>Manage your hiking journal, covers, and bulk actions in one place.</p>
                </div>
                <div className="toolbar-actions">
                    {!readOnly && (
                        <>
                            <button type="button" className="ghost-button" onClick={onImport}>
                                ⬇ Import
                            </button>
                            <button
                                type="button"
                                className="primary-button"
                                onClick={onNewTrip}
                            >
                                + New Trip
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="toolbar-row controls">
                <div className="search-field">
                    <span aria-hidden className="search-icon">🔍</span>
                    <input
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search trips by name, location or notes…"
                        aria-label="Search trips"
                    />
                </div>

                <label className="control">
                    <span>Sort</span>
                    <select
                        value={sortOption}
                        onChange={(e) => onSortChange(e.target.value)}
                        aria-label="Sort trips"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="control">
                    <span>Difficulty</span>
                    <select
                        value={filters.difficulty}
                        onChange={(e) => onFilterChange({ difficulty: e.target.value })}
                        aria-label="Filter by difficulty"
                    >
                        <option value="all">All</option>
                        <option value="easy">Easy</option>
                        <option value="moderate">Moderate</option>
                        <option value="hard">Hard</option>
                    </select>
                </label>

                <label className="control">
                    <span>GPX</span>
                    <select
                        value={filters.hasGpx}
                        onChange={(e) => onFilterChange({ hasGpx: e.target.value })}
                        aria-label="Filter by GPX"
                    >
                        <option value="all">All</option>
                        <option value="with">Has GPX</option>
                        <option value="without">No GPX</option>
                    </select>
                </label>

                <label className="control">
                    <span>Photos</span>
                    <select
                        value={filters.hasPhotos}
                        onChange={(e) => onFilterChange({ hasPhotos: e.target.value })}
                        aria-label="Filter by photos"
                    >
                        <option value="all">All</option>
                        <option value="with">Has photos</option>
                        <option value="without">No photos</option>
                    </select>
                </label>

                <label className="control">
                    <span>From</span>
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => onFilterChange({ startDate: e.target.value })}
                        aria-label="Filter start date from"
                    />
                </label>

                <label className="control">
                    <span>To</span>
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => onFilterChange({ endDate: e.target.value })}
                        aria-label="Filter end date to"
                    />
                </label>

                {!readOnly && (
                    <button
                        type="button"
                        className={`toggle-button ${selectMode ? 'active' : ''}`}
                        onClick={onToggleSelectMode}
                        aria-pressed={selectMode}
                    >
                        ▢ Select
                    </button>
                )}

                <div className="view-toggle" role="group" aria-label="Toggle view mode">
                    <button
                        type="button"
                        className={`toggle-button ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => onViewModeChange('grid')}
                        aria-pressed={viewMode === 'grid'}
                    >
                        ☷ Grid
                    </button>
                    <button
                        type="button"
                        className={`toggle-button ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => onViewModeChange('list')}
                        aria-pressed={viewMode === 'list'}
                    >
                        ☰ List
                    </button>
                </div>
            </div>
        </div>
    );
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
                <button type="button" className="ghost-button" onClick={onArchive}>
                    Archive
                </button>
                <button type="button" className="ghost-button danger" onClick={onDelete}>
                    Delete
                </button>
                <button type="button" className="ghost-button" onClick={onExport}>
                    Export GPX
                </button>
                <button type="button" className="ghost-button" onClick={onMerge}>
                    Merge ▾
                </button>
                <button
                    type="button"
                    className="ghost-button"
                    onClick={onExitSelect}
                    aria-label="Exit select mode"
                >
                    Esc
                </button>
            </div>
        </div>
    );
};

const EmptyStateCard = ({ onCreate, onImport, readOnly }) => {
    return (
        <div className="empty-state">
            <div className="empty-illustration">🥾</div>
            <h2>You don’t have any trips yet</h2>
            <p>Create a trip, upload your GPX track and photos to start your hiking journal.</p>
            {!readOnly && (
                <div className="empty-actions">
                    <button type="button" className="primary-button" onClick={onCreate}>
                        + Create your first trip
                    </button>
                    <button type="button" className="ghost-button" onClick={onImport}>
                        Import GPX history
                    </button>
                </div>
            )}
        </div>
    );
};

const normalizePhoto = (item) => {
    if (!item) return null;
    if (typeof item === 'string') {
        return {
            key: item,
            thumb: getImageUrl(item),
            url: getImageUrl(item),
            orientation: 'unknown',
            isCover: false,
        };
    }

    const metadata = item.metadata || {};
    const objectKey = item.object_key || item.key || item.id || '';
    if (!objectKey) return null;

    const thumb = metadata.thumb_url || metadata.thumbnail_url || getImageUrl(objectKey);
    const width = metadata.width || metadata.image_width || null;
    const height = metadata.height || metadata.image_height || null;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('newest');
    const [filters, setFilters] = useState(defaultFilters);
    const [viewMode, setViewMode] = useState('grid');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedTripIds, setSelectedTripIds] = useState([]);
    const [coverModalTrip, setCoverModalTrip] = useState(null);
    const [busyMessage, setBusyMessage] = useState('');

    const readOnly = !isAuthenticated;

    useEffect(() => {
        fetchTrips();
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (coverModalTrip) {
                    setCoverModalTrip(null);
                } else if (selectMode) {
                    setSelectMode(false);
                    setSelectedTripIds([]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [coverModalTrip, selectMode]);

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

    const toggleSelectMode = () => {
        setSelectMode((prev) => !prev);
        if (selectMode) {
            setSelectedTripIds([]);
        }
    };

    const handleSelectToggle = (tripId) => {
        setSelectedTripIds((prev) =>
            prev.includes(tripId) ? prev.filter((id) => id !== tripId) : [...prev, tripId]
        );
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

    const filteredTrips = useMemo(() => {
        const search = searchQuery.trim().toLowerCase();
        let results = [...trips];

        if (search) {
            results = results.filter((trip) => {
                const haystack = [
                    trip.name,
                    trip.title,
                    trip.region,
                    trip.location_name,
                    trip.notes,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(search);
            });
        }

        if (filters.difficulty !== 'all') {
            results = results.filter(
                (trip) => normalizeDifficulty(trip.difficulty) === filters.difficulty
            );
        }

        if (filters.hasGpx !== 'all') {
            results = results.filter((trip) =>
                filters.hasGpx === 'with' ? Boolean(trip.has_gpx) : !trip.has_gpx
            );
        }

        if (filters.hasPhotos !== 'all') {
            results = results.filter((trip) => {
                const count =
                    typeof trip.photo_count === 'number'
                        ? trip.photo_count
                        : Array.isArray(trip.photos)
                        ? trip.photos.length
                        : 0;
                return filters.hasPhotos === 'with' ? count > 0 : count === 0;
            });
        }

        if (filters.startDate) {
            const start = new Date(filters.startDate).getTime();
            results = results.filter((trip) => {
                const tripStart = new Date(trip.start_date || trip.created_at || 0).getTime();
                return tripStart >= start;
            });
        }

        if (filters.endDate) {
            const end = new Date(filters.endDate).getTime();
            results = results.filter((trip) => {
                const tripEnd = new Date(trip.end_date || trip.start_date || trip.created_at || 0).getTime();
                return tripEnd <= end;
            });
        }

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
    }, [filters, searchQuery, sortOption, trips]);

    const handleBulkDelete = async () => {
        if (selectedTripIds.length === 0) return;
        const confirmed = window.confirm(
            `Delete ${selectedTripIds.length} trip(s)? This cannot be undone.`
        );
        if (!confirmed) return;

        setBusyMessage('Deleting trips…');
        try {
            await Promise.all(selectedTripIds.map((id) => deleteTrip(id)));
            setTrips((prev) => prev.filter((trip) => !selectedTripIds.includes(trip.id)));
            setSelectedTripIds([]);
            setSelectMode(false);
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
            setSelectedTripIds((prev) => prev.filter((id) => id !== tripId));
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
            <TripsToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortOption={sortOption}
                onSortChange={setSortOption}
                filters={filters}
                onFilterChange={handleFilterChange}
                onNewTrip={() => setIsModalOpen(true)}
                onImport={handleImport}
                selectMode={selectMode}
                onToggleSelectMode={toggleSelectMode}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                readOnly={readOnly}
            />

            {busyMessage && <div className="inline-status">{busyMessage}</div>}

            {loading ? (
                <div className="loading">Loading trips…</div>
            ) : filteredTrips.length === 0 ? (
                <EmptyStateCard onCreate={() => setIsModalOpen(true)} onImport={handleImport} readOnly={readOnly} />
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
                            selectMode={selectMode}
                            selected={selectedTripIds.includes(trip.id)}
                            onSelectToggle={handleSelectToggle}
                            onOpenCover={setCoverModalTrip}
                            onDelete={handleDeleteTrip}
                            readOnly={readOnly}
                            isPinned={user?.pinned_trip_ids?.includes(trip.id)}
                            onTogglePin={handleTogglePin}
                        />
                    ))}
                </div>
            )}

            {!readOnly && (
                <BulkActionBar
                    selectedCount={selectedTripIds.length}
                    onArchive={handleBulkArchive}
                    onDelete={handleBulkDelete}
                    onExport={handleBulkExport}
                    onMerge={handleMerge}
                    onExitSelect={() => {
                        setSelectMode(false);
                        setSelectedTripIds([]);
                    }}
                />
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
