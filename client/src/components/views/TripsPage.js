import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTrips } from '../../services/api';
import CreateTripModal from '../common/CreateTripModal';
import './TripsPage.css'; // We'll create this CSS file next

const TripsPage = () => {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchTrips();
    }, []);

    const fetchTrips = async () => {
        try {
            const data = await getTrips();
            setTrips(data);
        } catch (error) {
            console.error("Failed to fetch trips:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTripCreated = (newTrip) => {
        setTrips(prev => [newTrip, ...prev]);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="trips-page">
            <div className="trips-header">
                <h1>My Trips</h1>
                <button className="create-trip-btn" onClick={() => setIsModalOpen(true)}>
                    + New Trip
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading trips...</div>
            ) : (
                <div className="trips-grid">
                    {trips.length === 0 ? (
                        <div className="no-trips">
                            <p>No trips yet. Create your first one!</p>
                        </div>
                    ) : (
                        trips.map(trip => (
                            <Link to={`/trips/${trip.id}`} key={trip.id} className="trip-card">
                                <div className="trip-card-content">
                                    <h3>{trip.name}</h3>
                                    <div className="trip-meta">
                                        {trip.region && <span className="trip-region">{trip.region}</span>}
                                        <span className="trip-dates">
                                            {formatDate(trip.start_date)}
                                            {trip.end_date && ` - ${formatDate(trip.end_date)}`}
                                        </span>
                                    </div>
                                    {trip.notes && <p className="trip-notes">{trip.notes}</p>}
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            )}

            <CreateTripModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onTripCreated={handleTripCreated}
            />
        </div>
    );
};

export default TripsPage;
