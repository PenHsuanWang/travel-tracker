import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../../services/api';
import { format } from 'date-fns';
import { FaMountain, FaRoad, FaCamera, FaRoute } from 'react-icons/fa'; // Icons for stats

// Placeholder for missing image
const PlaceholderImage = () => (
  <div className="trip-card-image-placeholder">
    <FaMountain className="placeholder-icon" />
    <span>No Image</span>
  </div>
);

const TripTimelineCard = memo(({ trip, onCardHover, onCardLeave, registerRef }) => {
  if (!trip) return null;

  const startDate = trip.start_date ? new Date(trip.start_date) : new Date(trip.created_at);
  const formattedDate = format(startDate, 'MMM dd');
  const excerpt = trip.notes ? trip.notes.substring(0, 100) + (trip.notes.length > 100 ? '...' : '') : 'No description available.';

  // Ensure cover_image_url is a full path if it's an object key
  const coverImageUrl = trip.cover_image_url
    ? (trip.cover_image_url.startsWith('http') ? trip.cover_image_url : getImageUrl(trip.cover_image_url))
    : null;

  const handleMouseEnter = () => {
    if (onCardHover) {
      onCardHover(trip.id, startDate, trip.end_date ? new Date(trip.end_date) : startDate);
    }
  };

  const handleMouseLeave = () => {
    if (onCardLeave) {
      onCardLeave();
    }
  };

  return (
    <div
      ref={(node) => registerRef(trip.id, node)} // Correctly pass trip.id and the DOM node
      className="trip-timeline-item"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="timeline-dot"></div>
      <Link to={`/trips/${trip.id}`} className="trip-card-link">
        <div className="trip-card-content-wrapper">
          <div className="trip-card-date">
            <span className="month">{formattedDate.split(' ')[0]}</span>
            <span className="day">{formattedDate.split(' ')[1]}</span>
          </div>
          <div className="trip-card-body">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt={trip.name}
                className="trip-card-thumbnail"
                loading="lazy"
              />
            ) : (
              <PlaceholderImage />
            )}
            <div className="trip-card-details">
              <h4 className="trip-card-title">{trip.name}</h4>
              <p className="trip-card-excerpt">{excerpt}</p>
              <div className="trip-card-stats">
                {trip.difficulty && (
                  <span className={`trip-card-difficulty difficulty-${trip.difficulty.toLowerCase()}`}>
                    {trip.difficulty}
                  </span>
                )}
                {trip.stats?.distance_km > 0 && (
                  <span><FaRoad /> {(trip.stats.distance_km || 0).toFixed(1)} km</span>
                )}
                {trip.stats?.elevation_gain_m > 0 && (
                  <span><FaMountain /> {(trip.stats.elevation_gain_m || 0).toFixed(0)} m</span>
                )}
                {trip.photo_count > 0 && (
                  <span><FaCamera /> {trip.photo_count}</span>
                )}
                {trip.has_gpx && (
                  <span><FaRoute /> GPX</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
});

export default TripTimelineCard;
