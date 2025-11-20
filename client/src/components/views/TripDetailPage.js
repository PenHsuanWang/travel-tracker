import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import LeafletMapView from './LeafletMapView';
import TripSidebar from '../layout/TripSidebar';
import { getTrip } from '../../services/api';
import '../../styles/MainBlock.css'; // Reuse MainBlock styles for layout

const TripDetailPage = () => {
    const { tripId } = useParams();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedLayer, setSelectedLayer] = useState('openstreetmap');
    const [selectedRivers, setSelectedRivers] = useState([]);

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

    if (loading) {
        return <div className="loading">Loading trip details...</div>;
    }

    if (!trip) {
        return <div className="error">Trip not found.</div>;
    }

    return (
        <div className="MainBlock">
            <TripSidebar
                tripId={tripId}
                selectedRivers={selectedRivers}
                setSelectedRivers={setSelectedRivers}
            />
            <main className="MapArea">
                <div className="trip-header-overlay" style={{
                    position: 'absolute',
                    top: '10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '0.5rem 1rem',
                    borderRadius: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    pointerEvents: 'none' // Allow clicking through to map
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>{trip.name}</h2>
                </div>
                <LeafletMapView
                    selectedLayer={selectedLayer}
                    setSelectedLayer={setSelectedLayer}
                    selectedRivers={selectedRivers}
                    tripId={tripId}
                />
            </main>
        </div>
    );
};

export default TripDetailPage;
