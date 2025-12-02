import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import userService from '../services/userService';
import { getImageUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ProfilePage.css';

const ProfilePage = () => {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        let data;
        if (username) {
          data = await userService.getUserProfile(username);
        } else {
          data = await userService.getProfile();
        }
        setProfile(data);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  if (loading) return <div className="profile-loading">Loading profile...</div>;
  if (error) return <div className="profile-error">{error}</div>;
  if (!profile) return <div className="profile-not-found">User not found.</div>;

  const isOwnProfile = !username || (currentUser && currentUser.username === profile.username);
  
  const avatarSrc = profile.avatar_url 
    ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : getImageUrl(profile.avatar_url))
    : '/default-avatar.svg';

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar-container">
          <img 
            src={avatarSrc} 
            alt={`${profile.username}'s avatar`} 
            className="profile-avatar" 
          />
        </div>
        <div className="profile-info">
          <h1 className="profile-username">{profile.username}</h1>
          {profile.full_name && <h2 className="profile-fullname">{profile.full_name}</h2>}
          {profile.location && <p className="profile-location">📍 {profile.location}</p>}
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          
          {isOwnProfile && (
            <Link to="/settings/profile" className="edit-profile-btn">Edit Profile</Link>
          )}
        </div>
      </div>

      <div className="profile-stats-grid">
        <div className="stat-card">
          <span className="stat-value">{profile.total_trips || 0}</span>
          <span className="stat-label">Trips</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{(profile.total_distance_km || 0).toFixed(1)} km</span>
          <span className="stat-label">Distance</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{(profile.total_elevation_gain_m || 0).toFixed(0)} m</span>
          <span className="stat-label">Elevation</span>
        </div>
      </div>

      {/* Placeholder for Badges/Achievements */}
      <div className="profile-section">
        <h3>Achievements</h3>
        <div className="badges-grid">
          {profile.earned_badges && profile.earned_badges.length > 0 ? (
            profile.earned_badges.map(badge => (
              <div key={badge} className="badge-item">{badge}</div>
            ))
          ) : (
            <p className="no-data">No badges earned yet.</p>
          )}
        </div>
      </div>

      {/* Pinned Trips */}
      <div className="profile-section">
        <h3>Pinned Trips</h3>
        <div className="pinned-trips-grid">
          {profile.pinned_trips && profile.pinned_trips.length > 0 ? (
            profile.pinned_trips.map(trip => (
              <Link to={`/trips/${trip.id}`} key={trip.id} className="pinned-trip-card">
                <div className="trip-card-content">
                  <h4 className="trip-title">{trip.name}</h4>
                  <div className="trip-meta">
                    <span className="trip-date">
                      {trip.start_date ? new Date(trip.start_date).toLocaleDateString() : 'No date'}
                    </span>
                    {trip.region && <span className="trip-region">{trip.region}</span>}
                  </div>
                  <div className="trip-stats-mini">
                    <span>{(trip.stats?.distance_km || 0).toFixed(1)} km</span>
                    <span>•</span>
                    <span>{(trip.stats?.elevation_gain_m || 0).toFixed(0)} m</span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="no-data">No pinned trips.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
