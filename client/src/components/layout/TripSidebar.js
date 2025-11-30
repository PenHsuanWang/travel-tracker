import React from 'react';
import ImageGalleryPanel from '../panels/ImageGalleryPanel';
import '../../styles/Sidebar.css';

const formatDate = (value) => {
    if (!value) {
        return null;
    }
    try {
        return new Date(value).toLocaleDateString();
    } catch (error) {
        return value;
    }
};

const TripSummaryCard = ({ trip, stats }) => {
    if (!trip) {
        return (
            <div className="TripSummaryCard">
                <p>Loading trip details…</p>
            </div>
        );
    }

    const start = formatDate(trip.start_date);
    const end = formatDate(trip.end_date);

    return (
        <div className="TripSummaryCard">
            <p style={{ margin: '0 0 4px', letterSpacing: '0.08em', fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>Trip overview</p>
            <h2>{trip.name}</h2>
            {trip.region && <p>{trip.region}</p>}
            {(start || end) && (
                <p>{start}{end ? ` – ${end}` : ''}</p>
            )}
            {trip.notes && (
                <p style={{ fontStyle: 'italic' }}>{trip.notes}</p>
            )}
            <div className="TripSummaryStats">
                <div className="TripSummaryStat">🖼 {stats.photos} photos</div>
                <div className="TripSummaryStat">🧭 {stats.tracks} tracks</div>
            </div>
        </div>
    );
};

function TripSidebar({
    tripId,
    trip,
    stats,
    onTripDataChange,
    notice,
    readOnly
}) {
    return (
        <aside className="Sidebar">
            <TripSummaryCard trip={trip} stats={stats} />
            {notice && (
                <div className="TripNotice" role="status">
                    {notice}
                </div>
            )}

            <ImageGalleryPanel tripId={tripId} onDataChange={onTripDataChange} readOnly={readOnly} />
        </aside>
    );
}

export default TripSidebar;
