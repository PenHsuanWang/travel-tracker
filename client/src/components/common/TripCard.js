/**
 * TripCard Component
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md
 * 
 * A specialized card component for displaying trip details.
 * Uses the unified Card compound component structure.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardCover, CardTitle, CardFooter } from './Card/Card'; // Importing from file directly to be safe
import { getImageUrl, getImageVariantUrl } from '../../services/api';
import './TripCard.css';

const normalizeDifficulty = (value) => {
    if (!value) return null;
    const lower = String(value).toLowerCase();
    if (['easy', 'moderate', 'moderate+', 'hard'].includes(lower)) return lower;
    return lower;
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

const TripCard = ({
    trip,
    viewMode = 'grid',
    selectMode = false,
    selected = false,
    onSelectToggle,
    onOpenCover,
    onDelete,
    readOnly = false,
    isPinned = false,
    onTogglePin,
    currentUserId,
}) => {
    const owner = trip.owner;
    // const isOwner = currentUserId && (trip.owner_id === currentUserId || (owner && owner.id === currentUserId));
    const canEdit = !readOnly; // Simplified for now, passing explicit handlers handles permissions
    const canPin = !readOnly;

    const coverUrl =
        trip.cover_image_url ||
        (trip.cover_photo_id ? getImageVariantUrl(trip.cover_photo_id, 'preview') : null);
    const hasCover = Boolean(coverUrl);
    
    const distanceLabel = trip.distance_km ? `${trip.distance_km} km` : '—';
    const difficulty = normalizeDifficulty(trip.difficulty);
    const difficultyLabel = difficulty
        ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
        : 'Not set';
    const gpxLabel = trip.has_gpx ? '✓' : '–';
    const photosLabel =
        typeof trip.photo_count === 'number' ? trip.photo_count : '—';

    const handleCardClick = (e) => {
        // If in select mode, any click on the card toggles selection (unless it was a button)
        if (selectMode) {
            e.preventDefault();
            onSelectToggle && onSelectToggle(trip.id);
        }
    };

    return (
        <Card
            variant="trip"
            className={`trip-card ${viewMode === 'list' ? 'list-view' : ''}`}
            selected={selected}
            onClick={handleCardClick}
            hoverable={true}
        >
            {/* Selection Checkbox */}
            {selectMode && (
                <label
                    className="trip-checkbox"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onSelectToggle && onSelectToggle(trip.id)}
                        aria-label={`Select ${trip.name || trip.title || ''}`}
                    />
                    <span className="checkbox-visual" aria-hidden="true" />
                </label>
            )}

            {/* Cover Image Area */}
            <CardCover className="cover-area" aspectRatio={viewMode === 'list' ? undefined : '16/9'}>
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
                            {canEdit && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    style={{ background: 'rgba(255,255,255,0.9)', color: '#000' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenCover && onOpenCover(trip);
                                    }}
                                >
                                    {hasCover ? 'Change' : 'Add cover'}
                                </button>
                            )}
                            {canPin && (
                                <button
                                    type="button"
                                    className={`btn btn-sm btn-ghost ${isPinned ? 'pinned' : ''}`}
                                    style={{ background: 'rgba(255,255,255,0.9)', color: isPinned ? 'var(--color-warning-500)' : '#000', padding: '6px' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin && onTogglePin(trip.id);
                                    }}
                                    title={isPinned ? "Unpin from profile" : "Pin to profile"}
                                >
                                    {isPinned ? '★' : '☆'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </CardCover>

            <CardBody>
                <div className="trip-title-row">
                    <CardTitle>
                         {/* Link title if not in select mode */}
                         {!selectMode ? (
                            <Link to={`/trips/${trip.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {trip.name || trip.title || 'Untitled trip'}
                            </Link>
                         ) : (
                             trip.name || trip.title || 'Untitled trip'
                         )}
                    </CardTitle>
                    <div className="trip-date">
                        {formatDateRange(trip.start_date, trip.end_date)}
                    </div>
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
            </CardBody>
            
            <CardFooter>
                 {!selectMode && (
                    <div className="trip-actions" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <Link
                            to={`/trips/${trip.id}`}
                            className="btn btn-primary btn-sm"
                            onClick={(e) => e.stopPropagation()}
                        >
                            View
                        </Link>
                        <Link
                            to={`/trips/${trip.id}`}
                            state={{ focus: 'map' }}
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => e.stopPropagation()}
                        >
                            Map
                        </Link>
                        
                        <div style={{ flex: 1 }} />
                        
                        {canEdit && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm danger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete && onDelete(trip.id);
                                }}
                                title="Delete Trip"
                            >
                                🗑
                            </button>
                        )}
                    </div>
                 )}
            </CardFooter>
        </Card>
    );
};

export default TripCard;
