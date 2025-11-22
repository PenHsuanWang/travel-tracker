import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import LeafletMapView from './LeafletMapView';
import TripSidebar from '../layout/TripSidebar';
import PhotoTimelinePanel from '../panels/PhotoTimelinePanel';
import PhotoViewerOverlay from '../common/PhotoViewerOverlay';
import { getTrip, getTrips, deleteTrip, listGpxFiles, listGpxFilesWithMeta, listImageFiles, getImageUrl, updatePhotoNote, fetchGpxAnalysis } from '../../services/api';
import '../../styles/MainBlock.css';
import '../../styles/TripDetailPage.css';

const parseDateSafe = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }

    const toDate = (input) => {
        const parsed = new Date(input);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    // Direct parse first (handles ISO strings)
    let parsed = toDate(value);
    if (parsed) return parsed;

    // Handle EXIF-style strings like "2024:05:20 10:00:00"
    const text = String(value);
    const exifMatch = text.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (exifMatch) {
        const [, y, m, d, hh, mm, ss] = exifMatch;
        parsed = toDate(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
        if (parsed) return parsed;
    }

    return null;
};

const normalizePhoto = (item) => {
    if (!item) return null;
    const metadata = item.metadata || {};
    const note = metadata.note || metadata.caption || metadata.notes || null;
    const noteTitle = metadata.note_title || (note ? note.split('\n')[0] : null);
    const capturedDate = parseDateSafe(metadata.captured_at || metadata.date_taken || metadata.created_at);
    const lat = Number(metadata?.gps?.latitude ?? metadata?.gps?.lat ?? item.lat);
    const lon = Number(metadata?.gps?.longitude ?? metadata?.gps?.lon ?? item.lon);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

    return {
        type: 'photo',
        id: item.object_key,
        objectKey: item.object_key,
        fileName: metadata.original_filename || item.object_key,
        thumbnailUrl: metadata.thumb_url || metadata.thumbnail_url || item.thumb_url || getImageUrl(item.object_key),
        imageUrl: getImageUrl(item.object_key),
        capturedAt: capturedDate ? capturedDate.toISOString() : null,
        capturedDate,
        capturedSource: metadata.captured_source || (metadata.date_taken ? 'exif' : metadata.created_at ? 'fallback' : 'unknown'),
        lat: hasCoords ? lat : null,
        lon: hasCoords ? lon : null,
        metadataId: item.metadata_id || null,
        caption: metadata.caption || metadata.notes || null,
        note,
        noteTitle,
        orderIndex: metadata.order_index ?? null,
    };
};

const normalizeWaypoint = (waypoint, gpxFileName, index) => {
    if (!waypoint) return null;
    const capturedDate = parseDateSafe(waypoint.time);
    const lat = Number(waypoint.lat);
    const lon = Number(waypoint.lon);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

    if (!hasCoords) return null;

    return {
        type: 'waypoint',
        id: `waypoint-${gpxFileName}-${index}`,
        gpxSource: gpxFileName,
        fileName: `Waypoint ${index + 1}`,
        capturedAt: capturedDate ? capturedDate.toISOString() : null,
        capturedDate,
        capturedSource: 'gpx',
        lat,
        lon,
        elev: waypoint.elev !== null && waypoint.elev !== undefined ? Number(waypoint.elev) : null,
        note: waypoint.note || null,
        noteTitle: null,
    };
};

const sortPhotosChronologically = (a, b) => {
    if (a?.capturedDate && b?.capturedDate) {
        return a.capturedDate.getTime() - b.capturedDate.getTime();
    }
    if (a?.capturedDate) return -1;
    if (b?.capturedDate) return 1;
    return (a?.fileName || '').localeCompare(b?.fileName || '');
};

const computeTimelineMode = (width) => {
    if (width < 1024) return 'sheet';
    if (width < 1180) return 'overlay';
    return 'side';
};

const MIN_TIMELINE_WIDTH = 280;
const MAX_TIMELINE_WIDTH = 600;
const DEFAULT_TIMELINE_WIDTH = 360;

const clampTimelineWidth = (value) => Math.min(MAX_TIMELINE_WIDTH, Math.max(MIN_TIMELINE_WIDTH, value));

const getStoredTimelineWidth = () => {
    if (typeof window === 'undefined') {
        return DEFAULT_TIMELINE_WIDTH;
    }
    const stored = Number(window.localStorage.getItem('tripTimelineWidth'));
    if (Number.isFinite(stored)) {
        return clampTimelineWidth(stored);
    }
    return DEFAULT_TIMELINE_WIDTH;
};

const TripDetailPage = () => {
    const { tripId } = useParams();
    const [trip, setTrip] = useState(null);
    const [allTrips, setAllTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLayer, setSelectedLayer] = useState('openstreetmap');
    const [selectedRivers, setSelectedRivers] = useState([]);
    const [tripStats, setTripStats] = useState({ photos: 0, tracks: 0 });
    const [tripNotice, setTripNotice] = useState('');
    const [photos, setPhotos] = useState([]);
    const [waypoints, setWaypoints] = useState([]);
    const [photosLoading, setPhotosLoading] = useState(false);
    const [selectedPhotoId, setSelectedPhotoId] = useState(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [timelineMode, setTimelineMode] = useState('side');
    const [timelineOpen, setTimelineOpen] = useState(true);
    const [timelineWidth, setTimelineWidth] = useState(() => getStoredTimelineWidth());
    const mapRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTripDetails = async () => {
            try {
                const data = await getTrip(tripId);
                setTrip(data);
            } catch (error) {
                console.error("Failed to fetch trip details:", error);
            } finally {
                setLoading(false);
            }
        };

        if (tripId) {
            fetchTripDetails();
        }
    }, [tripId]);

    useEffect(() => {
        const fetchTripsList = async () => {
            try {
                const data = await getTrips();
                setAllTrips(data);
            } catch (error) {
                console.error('Failed to fetch trips list:', error);
            }
        };

        fetchTripsList();
    }, []);

    const orderedPhotos = useMemo(() => [...photos].sort(sortPhotosChronologically), [photos]);
    const selectedPhoto = useMemo(
        () => orderedPhotos.find((photo) => photo.id === selectedPhotoId) || null,
        [orderedPhotos, selectedPhotoId]
    );
    const selectedPhotoIndex = useMemo(
        () => orderedPhotos.findIndex((photo) => photo.id === selectedPhotoId),
        [orderedPhotos, selectedPhotoId]
    );

    const refreshTripStats = useCallback(async () => {
        if (!tripId) {
            return;
        }

        try {
            const [images, gpxFiles] = await Promise.all([
                listImageFiles(tripId),
                listGpxFiles(tripId)
            ]);
            setTripStats({
                photos: Array.isArray(images) ? images.length : 0,
                tracks: Array.isArray(gpxFiles) ? gpxFiles.length : 0
            });
        } catch (error) {
            console.error('Failed to load trip stats:', error);
        }
    }, [tripId]);

    const loadTripPhotos = useCallback(async () => {
        if (!tripId) return;
        setPhotosLoading(true);
        try {
            const files = await listImageFiles(tripId);
            const normalized = (Array.isArray(files) ? files : [])
                .map(normalizePhoto)
                .filter(Boolean)
                .sort(sortPhotosChronologically);
            setPhotos(normalized);
        } catch (error) {
            console.error('Failed to load trip photos:', error);
            setPhotos([]);
        } finally {
            setPhotosLoading(false);
        }
    }, [tripId]);

    const loadTripWaypoints = useCallback(async () => {
        if (!tripId) return;
        try {
            const gpxFiles = await listGpxFilesWithMeta(tripId);
            const allWaypoints = [];
            
            for (const gpxFile of gpxFiles) {
                try {
                    const analysisData = await fetchGpxAnalysis(gpxFile.object_key, tripId);
                    const waypointsFromFile = (analysisData.waypoints || [])
                        .map((wp, idx) => normalizeWaypoint(wp, gpxFile.object_key, idx))
                        .filter(Boolean);
                    allWaypoints.push(...waypointsFromFile);
                } catch (error) {
                    console.error(`Failed to load waypoints from ${gpxFile.object_key}:`, error);
                }
            }
            
            setWaypoints(allWaypoints);
        } catch (error) {
            console.error('Failed to load trip waypoints:', error);
            setWaypoints([]);
        }
    }, [tripId]);

    // Merge photos and waypoints into unified timeline
    const timelineItems = useMemo(() => {
        return [...photos, ...waypoints].sort(sortPhotosChronologically);
    }, [photos, waypoints]);

    useEffect(() => {
        refreshTripStats();
        loadTripPhotos();
        loadTripWaypoints();
    }, [refreshTripStats, loadTripPhotos, loadTripWaypoints]);

    useEffect(() => {
        // Keep layout responsive: side rail on wide screens, overlay on medium, bottom sheet on tablet/mobile.
        const handleModeUpdate = () => {
            const nextMode = computeTimelineMode(window.innerWidth || 0);
            setTimelineMode((prev) => {
                if (prev !== nextMode) {
                    if (nextMode === 'side') {
                        setTimelineOpen(true);
                    } else if (prev === 'side') {
                        setTimelineOpen(false);
                    }
                }
                return nextMode;
            });
        };

        handleModeUpdate();
        window.addEventListener('resize', handleModeUpdate);
        return () => window.removeEventListener('resize', handleModeUpdate);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        try {
            window.localStorage.setItem('tripTimelineWidth', String(timelineWidth));
        } catch (error) {
            // ignore storage errors (private mode, etc.)
        }
        return undefined;
    }, [timelineWidth]);

    useEffect(() => {
        const mapInstance = mapRef.current;
        if (!mapInstance || typeof mapInstance.invalidateSize !== 'function') {
            return;
        }
        mapInstance.invalidateSize();
    }, [timelineWidth, timelineMode]);

    useEffect(() => {
        const handleImageUpload = () => {
            loadTripPhotos();
            refreshTripStats();
        };
        window.addEventListener('imageUploaded', handleImageUpload);
        window.addEventListener('imageDeleted', handleImageUpload);
        return () => {
            window.removeEventListener('imageUploaded', handleImageUpload);
            window.removeEventListener('imageDeleted', handleImageUpload);
        };
    }, [loadTripPhotos, refreshTripStats]);

    useEffect(() => {
        setSelectedPhotoId(null);
        setIsViewerOpen(false);
        setPhotos([]);
        setTripStats({ photos: 0, tracks: 0 });
    }, [tripId]);

    useEffect(() => {
        if (!tripNotice) {
            return undefined;
        }
        const timer = setTimeout(() => setTripNotice(''), 6000);
        return () => clearTimeout(timer);
    }, [tripNotice]);

    useEffect(() => {
        if (selectedPhotoId && orderedPhotos.length > 0) {
            const exists = orderedPhotos.some((photo) => photo.id === selectedPhotoId);
            if (!exists) {
                setSelectedPhotoId(null);
                setIsViewerOpen(false);
            }
        }
    }, [orderedPhotos, selectedPhotoId]);

    const handleSelectPhoto = useCallback((photoInput, options = {}) => {
        const { openViewer = true, centerMap = true, ensureTimeline = true } = options;
        const photo =
            typeof photoInput === 'string'
                ? orderedPhotos.find((item) => item.id === photoInput || item.objectKey === photoInput)
                : photoInput;

        if (!photo) return;

        setSelectedPhotoId(photo.id);
        if (openViewer) {
            setIsViewerOpen(true);
        }
        if (ensureTimeline && timelineMode !== 'side') {
            setTimelineOpen(true);
        }
        if (centerMap) {
            const detail = {
                object_key: photo.objectKey,
                source: 'trip-photo-timeline',
            };
            if (photo.lat !== null && photo.lon !== null) {
                detail.lat = photo.lat;
                detail.lng = photo.lon;
            }
            window.dispatchEvent(new CustomEvent('centerMapOnLocation', { detail }));
        }
    }, [orderedPhotos, timelineMode]);

    const handleResizerMouseDown = useCallback((event) => {
        if (timelineMode !== 'side') return;
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = timelineWidth;
        let animationFrameId = null;

        const handleMouseMove = (moveEvent) => {
            const delta = startX - moveEvent.clientX;
            const nextWidth = clampTimelineWidth(startWidth + delta);
            
            // Throttle updates using requestAnimationFrame for smooth resizing
            if (animationFrameId === null) {
                animationFrameId = requestAnimationFrame(() => {
                    setTimelineWidth(nextWidth);
                    // Immediately invalidate map size during drag
                    if (mapRef.current && typeof mapRef.current.invalidateSize === 'function') {
                        mapRef.current.invalidateSize({ pan: false });
                    }
                    animationFrameId = null;
                });
            }
        };

        const handleMouseUp = () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            // Final invalidation on mouse up
            if (mapRef.current && typeof mapRef.current.invalidateSize === 'function') {
                mapRef.current.invalidateSize();
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [timelineMode, timelineWidth]);

    const handleMapPhotoSelected = useCallback(
        (image) => {
            if (!image) return;
            const key = image.object_key || image.objectKey;
            if (!key) return;
            handleSelectPhoto(key, { openViewer: true, centerMap: false, ensureTimeline: true });
        },
        [handleSelectPhoto]
    );

    const goToPrevious = useCallback(() => {
        if (selectedPhotoIndex > 0) {
            const prevPhoto = orderedPhotos[selectedPhotoIndex - 1];
            handleSelectPhoto(prevPhoto, { openViewer: true, centerMap: true, ensureTimeline: true });
        }
    }, [orderedPhotos, selectedPhotoIndex, handleSelectPhoto]);

    const goToNext = useCallback(() => {
        if (selectedPhotoIndex < orderedPhotos.length - 1) {
            const nextPhoto = orderedPhotos[selectedPhotoIndex + 1];
            handleSelectPhoto(nextPhoto, { openViewer: true, centerMap: true, ensureTimeline: true });
        }
    }, [orderedPhotos, selectedPhotoIndex, handleSelectPhoto]);

    const handleTripDataChange = useCallback((payload = {}) => {
        if (payload.trip) {
            setTrip(payload.trip);
        }
        if (payload.notice) {
            setTripNotice(payload.notice);
        }
        refreshTripStats();
        loadTripPhotos();
    }, [refreshTripStats, loadTripPhotos]);

    const deriveNoteTitle = (noteTitleValue, noteValue) => {
        if (noteTitleValue) return noteTitleValue;
        if (noteValue) {
            const firstLine = String(noteValue).split('\n')[0].trim();
            return firstLine || null;
        }
        return null;
    };

    const applyNoteToPhotoState = useCallback((photoId, { note, noteTitle }) => {
        setPhotos((prev) =>
            prev.map((p) =>
                p.id === photoId
                    ? {
                          ...p,
                          note,
                          noteTitle: deriveNoteTitle(noteTitle, note),
                      }
                    : p
            )
        );
    }, []);

    const handleNoteSave = useCallback(
        async ({ photoId, metadataId, note, noteTitle }) => {
            if (!photoId && !metadataId) return;
            const targetId = metadataId || photoId;
            const previous = photos.find((p) => p.id === photoId);
            applyNoteToPhotoState(photoId, { note, noteTitle });
            try {
                const result = await updatePhotoNote(targetId, {
                    note,
                    note_title: noteTitle,
                });
                const updatedNote = result.note ?? note;
                const updatedTitle = result.note_title ?? noteTitle;
                applyNoteToPhotoState(photoId, { note: updatedNote, noteTitle: updatedTitle });
                // notify other listeners (e.g., map layer)
                window.dispatchEvent(
                    new CustomEvent('photoNoteUpdated', {
                        detail: {
                            object_key: photoId,
                            metadata_id: targetId,
                            note: updatedNote,
                            note_title: updatedTitle,
                        },
                    })
                );
            } catch (error) {
                console.error('Failed to save note', error);
                if (previous) {
                    applyNoteToPhotoState(photoId, { note: previous.note, noteTitle: previous.noteTitle });
                }
                alert('Failed to save note. Please try again.');
            }
        },
        [applyNoteToPhotoState, photos]
    );

    useEffect(() => {
        const handleExternalNoteUpdate = (event) => {
            const detail = event.detail || {};
            if (!detail.object_key) return;
            applyNoteToPhotoState(detail.object_key, {
                note: detail.note,
                noteTitle: detail.note_title,
            });
        };
        window.addEventListener('photoNoteUpdated', handleExternalNoteUpdate);
        return () => window.removeEventListener('photoNoteUpdated', handleExternalNoteUpdate);
    }, [applyNoteToPhotoState]);

    const handleTripChange = (event) => {
        const newTripId = event.target.value;
        if (newTripId && newTripId !== tripId) {
            navigate(`/trips/${newTripId}`);
        }
    };

    const handleDeleteTrip = async () => {
        const confirmed = window.confirm('Delete this trip and all associated GPX tracks and photos? This will remove uploaded files and analysis data.');
        if (!confirmed) return;
        try {
            await deleteTrip(tripId);
            navigate('/trips');
        } catch (error) {
            console.error('Failed to delete trip', error);
            alert('Failed to delete trip. Please try again.');
        }
    };

    if (loading) {
        return <div className="loading">Loading trip details...</div>;
    }

    if (!trip) {
        return <div className="error">Trip not found.</div>;
    }

    return (
        <div className="TripDetailPage">
            <div className="trip-detail-header">
                <div className="trip-detail-header__left">
                    <Link to="/trips" className="back-to-trips">← Back to My Trips</Link>
                    <div>
                        <p className="trip-detail-label">Currently viewing</p>
                        <h1 className="trip-detail-title">{trip.name}</h1>
                    </div>
                </div>
                <div className="trip-detail-header__right">
                    <label htmlFor="trip-selector">Quick switch</label>
                    <select
                        id="trip-selector"
                        className="trip-selector"
                        value={tripId}
                        onChange={handleTripChange}
                    >
                        {(allTrips.length ? allTrips : [trip]).map((listTrip) => (
                            <option key={listTrip.id} value={listTrip.id}>
                                {listTrip.name}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="ghost-button danger-button"
                        onClick={handleDeleteTrip}
                    >
                        Delete Trip
                    </button>
                </div>
            </div>
            <div className="MainBlock">
                <TripSidebar
                    tripId={tripId}
                    trip={trip}
                    selectedRivers={selectedRivers}
                    setSelectedRivers={setSelectedRivers}
                    stats={tripStats}
                    onTripDataChange={handleTripDataChange}
                    notice={tripNotice}
                />
                <div
                    className={`MapAndTimeline ${timelineMode !== 'side' ? 'timeline-floating' : ''} ${timelineMode === 'sheet' ? 'timeline-sheet' : ''}`}
                    style={{ '--timeline-width': `${timelineWidth}px` }}
                >
                    <main className="MapArea">
                        {timelineMode !== 'side' && (
                            <button
                                className="timeline-toggle-btn"
                                onClick={() => setTimelineOpen((value) => !value)}
                            >
                                {timelineOpen ? 'Hide photo timeline' : 'Show photo timeline'}
                            </button>
                        )}
                        <LeafletMapView
                            selectedLayer={selectedLayer}
                            setSelectedLayer={setSelectedLayer}
                            selectedRivers={selectedRivers}
                            tripId={tripId}
                            onImageSelected={handleMapPhotoSelected}
                            mapRef={mapRef}
                        />
                    </main>
                    {timelineMode === 'side' && (
                        <>
                            <div
                                className="Resizer"
                                onMouseDown={handleResizerMouseDown}
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize timeline"
                            />
                            <PhotoTimelinePanel
                                photos={timelineItems}
                                selectedPhotoId={selectedPhotoId}
                                onSelectPhoto={(photo) => handleSelectPhoto(photo, { openViewer: true, centerMap: true })}
                                isOpen
                                mode="side"
                                loading={photosLoading}
                                onEditNote={handleNoteSave}
                            />
                        </>
                    )}
                    {timelineMode !== 'side' && (
                        <PhotoTimelinePanel
                            photos={timelineItems}
                            selectedPhotoId={selectedPhotoId}
                            onSelectPhoto={(photo) => handleSelectPhoto(photo, { openViewer: true, centerMap: true })}
                            isOpen={timelineOpen}
                            mode={timelineMode === 'sheet' ? 'sheet' : 'overlay'}
                            onClose={() => setTimelineOpen(false)}
                            loading={photosLoading}
                            onEditNote={handleNoteSave}
                        />
                    )}
                </div>
            </div>
            <PhotoViewerOverlay
                isOpen={isViewerOpen && Boolean(selectedPhoto)}
                photo={selectedPhoto}
                index={selectedPhotoIndex >= 0 ? selectedPhotoIndex : 0}
                total={orderedPhotos.length}
                onClose={() => setIsViewerOpen(false)}
                onPrev={goToPrevious}
                onNext={goToNext}
            />
        </div>
    );
};

export default TripDetailPage;
