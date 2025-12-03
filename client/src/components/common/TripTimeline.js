import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import TripTimelineCard from './TripTimelineCard';
import '../../styles/TripTimeline.css';

const TripTimeline = memo(({ trips, onCardHover, onCardLeave, registerRef }) => {
  if (!trips || trips.length === 0) {
    return (
      <div className="trip-timeline-empty">
        <p>Your journey starts here! Record your first trip to see it on your timeline.</p>
        <Link to="/trips" className="button primary">Start a New Trip</Link>
      </div>
    );
  }

  // Group trips by year for date labels
  const tripsByYear = trips.reduce((acc, trip) => {
    const year = new Date(trip.start_date || trip.created_at).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(trip);
    return acc;
  }, {});

  const years = Object.keys(tripsByYear).sort((a, b) => b - a);

  return (
    <div className="trip-timeline">
      {years.map(year => (
        <div key={year} className="timeline-year-group">
          <div className="timeline-year-marker">{year}</div>
          {tripsByYear[year].map((trip) => (
            <TripTimelineCard
              key={trip.id}
              trip={trip}
              onCardHover={onCardHover}
              onCardLeave={onCardLeave}
              registerRef={registerRef}
            />
          ))}
        </div>
      ))}
    </div>
  );
});

export default TripTimeline;
