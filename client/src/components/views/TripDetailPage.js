import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import LeafletMapView from './LeafletMapView';
import TripSidebar from '../layout/TripSidebar';
import { getTrip, getTrips, listGpxFiles, listImageFiles } from '../../services/api';
import '../../styles/MainBlock.css';
import '../../styles/TripDetailPage.css';

const TripDetailPage = () => {
    const { tripId } = useParams();
    const [trip, setTrip] = useState(null);
    const [allTrips, setAllTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLayer, setSelectedLayer] = useState('openstreetmap');
    const [selectedRivers, setSelectedRivers] = useState([]);
    const [tripStats, setTripStats] = useState({ photos: 0, tracks: 0 });
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

    useEffect(() => {
        refreshTripStats();
    }, [refreshTripStats]);

    const handleTripChange = (event) => {
        const newTripId = event.target.value;
        if (newTripId && newTripId !== tripId) {
            navigate(`/trips/${newTripId}`);
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
                </div>
            </div>
            <div className="MainBlock">
                <TripSidebar
                    tripId={tripId}
                    trip={trip}
                    selectedRivers={selectedRivers}
                    setSelectedRivers={setSelectedRivers}
                    stats={tripStats}
                    onTripDataChange={refreshTripStats}
                />
                <main className="MapArea">
                    <LeafletMapView
                        selectedLayer={selectedLayer}
                        setSelectedLayer={setSelectedLayer}
                        selectedRivers={selectedRivers}
                        tripId={tripId}
                    />
                </main>
            </div>
        </div>
    );
};

export default TripDetailPage;
