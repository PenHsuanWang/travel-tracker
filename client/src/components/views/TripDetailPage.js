import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LeafletMapView from './LeafletMapView';
import TripSidebar from '../layout/TripSidebar';
import TimelinePanel from '../panels/TimelinePanel';
import TripStatsHUD from '../panels/TripStatsHUD';
import PhotoViewerOverlay from '../common/PhotoViewerOverlay';
import { getTrip, getTrips, deleteTrip, listGpxFiles, listGpxFilesWithMeta, listImageFiles, getImageUrl, updatePhotoNote, fetchGpxAnalysis, uploadFile, deleteImage, deleteFile } from '../../services/api';
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

const deriveNoteTitleValue = (providedTitle, noteValue) => {
    if (providedTitle) return providedTitle;
    if (noteValue) {
        const firstLine = String(noteValue).split('\n')[0].trim();
        return firstLine || null;
    }
    return null;
};

const normalizePhoto = (item) => {
    if (!item) return null;
    const metadata = item.metadata || {};
    const note = metadata.note || metadata.caption || metadata.notes || null;
    const noteTitle = deriveNoteTitleValue(metadata.note_title, note);
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
        timestamp: capturedDate ? capturedDate.getTime() : 0,
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
    const rawNote = waypoint.note || waypoint.desc || waypoint.name || null;
    const waypointTitle = deriveNoteTitleValue(waypoint.title || waypoint.name || null, rawNote);

    if (!hasCoords) return null;

    return {
        type: 'waypoint',
        id: `waypoint-${gpxFileName}-${index}`,
        gpxSource: gpxFileName,
        fileName: `Waypoint ${index + 1}`,
        capturedAt: capturedDate ? capturedDate.toISOString() : null,
        capturedDate,
        timestamp: capturedDate ? capturedDate.getTime() : 0,
        capturedSource: 'gpx',
        lat,
        lon,
        elev: waypoint.elev !== null && waypoint.elev !== undefined ? Number(waypoint.elev) : null,
        note: rawNote,
        noteTitle: waypointTitle,
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
    const { isAuthenticated } = useAuth();
    const { tripId } = useParams();
    const [trip, setTrip] = useState(null);
    const [allTrips, setAllTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLayer, setSelectedLayer] = useState('rudy map');
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

    const readOnly = !isAuthenticated;

    // Lifted GPX State
    // Refactored: Single GPX file per trip
    const [gpxFile, setGpxFile] = useState(null);
    const [gpxTrack, setGpxTrack] = useState(null); // The analyzed track data
    const [highlightedItemId, setHighlightedItemId] = useState(null);

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

    // Load GPX file (Single)
    const refreshGpxTrack = useCallback(async () => {
        if (!tripId) return;
        try {
            const files = await listGpxFilesWithMeta(tripId);
            if (files && files.length > 0) {
                // Take the first one (backend enforces single, but frontend should be robust)
                const file = files[0];
                setGpxFile(file);
                
                // Auto-load analysis
                const objectKey = file.object_key;
                try {
                    const trackData = await fetchGpxAnalysis(objectKey, tripId);
                    if (trackData.coordinates && trackData.coordinates.length > 0) {
                        setGpxTrack({
                            coordinates: trackData.coordinates,
                            summary: trackData.track_summary,
                            source: trackData.source,
                            displayName: trackData.display_name || objectKey,
                            waypoints: trackData.waypoints || [],
                            rest_points: trackData.rest_points || []
                        });
                        console.log(`GPX track loaded: ${objectKey}`);
                    }
                } catch (err) {
                    console.error('Error fetching analyzed GPX data:', err);
                }
            } else {
                setGpxFile(null);
                setGpxTrack(null);
            }
        } catch (err) {
            console.error('Error listing GPX files:', err);
        }
    }, [tripId]);

    useEffect(() => {
        refreshGpxTrack();
    }, [refreshGpxTrack]);

    // Compute waypoints from loaded track
    const trackWaypoints = useMemo(() => {
        if (!gpxTrack) return [];
        return (gpxTrack.waypoints || [])
            .map((wp, idx) => normalizeWaypoint(wp, gpxFile?.object_key || 'track', idx))
            .filter(Boolean);
    }, [gpxTrack, gpxFile]);

    // Merge photos and waypoints into unified timeline
    // Note: We use trackWaypoints instead of the separate 'waypoints' state now
    const timelineItems = useMemo(() => {
        return [...photos, ...trackWaypoints].sort(sortPhotosChronologically);
    }, [photos, trackWaypoints]);

    useEffect(() => {
        refreshTripStats();
        loadTripPhotos();
        // loadTripWaypoints(); // Removed, now handled by gpxTracks
    }, [refreshTripStats, loadTripPhotos]);

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
        setGpxFile(null);
        setGpxTrack(null);
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
        refreshGpxTrack();
    }, [refreshTripStats, loadTripPhotos, refreshGpxTrack]);

    const applyNoteToPhotoState = useCallback((photoId, { note, noteTitle }) => {
        setPhotos((prev) =>
            prev.map((p) =>
                p.id === photoId
                    ? {
                        ...p,
                        note,
                        noteTitle: deriveNoteTitleValue(noteTitle, note),
                    }
                    : p
            )
        );
    }, []);

    const applyNoteToWaypointState = useCallback((waypointId, { note, noteTitle, timestamp }) => {
        // We need to update gpxTrack state because that's the source of truth for waypoints now
        setGpxTrack((prevTrack) => {
            if (!prevTrack) return prevTrack;
            
            const updatedWaypoints = (prevTrack.waypoints || []).map((wp, idx) => {
                // Construct ID to match normalizeWaypoint logic: `waypoint-${gpxFileName}-${index}`
                // Since we have single track, we use the source or 'track' as filename part
                const filename = prevTrack.source || gpxFile?.object_key || 'track';
                const id = `waypoint-${filename}-${idx}`;
                
                if (id === waypointId) {
                    return {
                        ...wp,
                        note: note !== undefined ? note : wp.note,
                        title: noteTitle !== undefined ? noteTitle : (wp.title || wp.name),
                        time: timestamp ? new Date(timestamp).toISOString() : wp.time
                    };
                }
                return wp;
            });

            return {
                ...prevTrack,
                waypoints: updatedWaypoints
            };
        });
    }, [gpxFile]);

    const handleNoteSave = useCallback(
        async ({ itemType = 'photo', photoId, waypointId, metadataId, note, noteTitle, timestamp }) => {
            if (itemType === 'waypoint' && waypointId) {
                applyNoteToWaypointState(waypointId, { note, noteTitle, timestamp });
                // TODO: Persist waypoint changes to backend (not yet implemented in API)
                return;
            }

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
        [applyNoteToPhotoState, applyNoteToWaypointState, photos]
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

    const handleAddPhoto = useCallback(async (fileList) => {
        if (!tripId) return;
        setPhotosLoading(true);
        try {
            const uploads = Array.from(fileList).map(file => uploadFile(file, tripId));
            const results = await Promise.all(uploads);
            
            // Dispatch events for other components (like ImageLayer)
            window.dispatchEvent(new CustomEvent('imageUploaded'));
            
            results.forEach(result => {
                if (result && result.has_gps && result.gps) {
                    window.dispatchEvent(new CustomEvent('imageUploadedWithGPS', {
                        detail: {
                            object_key: result.object_key || result.metadata_id, // Fallback if object_key missing
                            original_filename: result.filename,
                            thumb_url: result.file_url, // Or construct if needed
                            gps: result.gps,
                            metadata_id: result.metadata_id
                        }
                    }));
                }
            });

            // Refresh list after upload
            await loadTripPhotos();
            await refreshTripStats();
        } catch (error) {
            console.error('Failed to upload photos:', error);
            alert('Failed to upload some photos. Please try again.');
        } finally {
            setPhotosLoading(false);
        }
    }, [tripId, loadTripPhotos, refreshTripStats]);

    const handleAddUrl = useCallback(() => {
        // Placeholder for future implementation
        const url = prompt("Enter photo URL (not yet fully implemented):");
        if (url) {
            console.log("Adding URL:", url);
            alert("URL adding is not yet supported by the backend.");
        }
    }, []);

    const handleDeletePhoto = useCallback(async (itemId) => {
        if (!itemId) return;

        // Check if it's a photo (not a waypoint)
        const photo = photos.find(p => p.id === itemId);
        if (!photo) {
            console.warn("Item to delete not found or is not a photo:", itemId);
            return;
        }

        try {
            // Assuming itemId is the object_key or filename
            await deleteImage(photo.fileName || photo.objectKey);

            // Optimistic update or refresh
            setPhotos(prev => prev.filter(p => p.id !== itemId));
            await refreshTripStats();
        } catch (error) {
            console.error('Failed to delete photo:', error);
            alert('Failed to delete photo. Please try again.');
        }
    }, [photos, refreshTripStats]);

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
                    {!readOnly && (
                        <button
                            type="button"
                            className="ghost-button danger-button"
                            onClick={handleDeleteTrip}
                        >
                            Delete Trip
                        </button>
                    )}
                </div>
            </div>
            <div className="MainBlock">
                <TripSidebar
                    tripId={tripId}
                    trip={trip}
                    stats={tripStats}
                    onTripDataChange={handleTripDataChange}
                    notice={tripNotice}
                    readOnly={readOnly}
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
                            // GPX Props (Refactored)
                            gpxTrack={gpxTrack}
                            highlightedItemId={highlightedItemId}
                            readOnly={readOnly}
                        />
                        {gpxTrack && gpxTrack.summary && (
                            <TripStatsHUD trackSummary={gpxTrack.summary} />
                        )}
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
                            <div style={{ width: 'var(--timeline-width)', flex: '0 0 var(--timeline-width)', height: '100%', borderLeft: '1px solid #e2e8f0' }}>
                                <TimelinePanel
                                    items={timelineItems}
                                    onAddPhoto={handleAddPhoto}
                                    onAddUrl={handleAddUrl}
                                    onUpdateItem={handleNoteSave}
                                    onDeleteItem={handleDeletePhoto}
                                    onItemClick={(item) => handleSelectPhoto(item, { openViewer: true, centerMap: true })}
                                    onItemHover={(id, isHovering) => setHighlightedItemId(isHovering ? id : null)}
                                    readOnly={readOnly}
                                />
                            </div>
                        </>
                    )}
                    {timelineMode !== 'side' && (
                        <div
                            className={`absolute z-[1200] bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${timelineMode === 'sheet'
                                ? 'left-0 right-0 bottom-0 h-[70vh] rounded-t-2xl border-t border-slate-200'
                                : 'right-4 top-4 bottom-4 w-[400px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200'
                                }`}
                        >
                            <div className="flex justify-end p-2 border-b border-slate-100 bg-slate-50">
                                <button onClick={() => setTimelineOpen(false)} className="text-slate-500 hover:text-slate-700 text-sm font-medium px-2 py-1">Close</button>
                            </div>
                            <TimelinePanel
                                items={timelineItems}
                                onAddPhoto={handleAddPhoto}
                                onAddUrl={handleAddUrl}
                                onUpdateItem={handleNoteSave}
                                onDeleteItem={handleDeletePhoto}
                                onItemClick={(item) => handleSelectPhoto(item, { openViewer: true, centerMap: true })}
                                onItemHover={(id, isHovering) => setHighlightedItemId(isHovering ? id : null)}
                                readOnly={readOnly}
                            />
                        </div>
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
