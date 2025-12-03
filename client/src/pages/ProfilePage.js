import React, { useEffect, useMemo, useState, useRef, useCallback, memo } from 'react';
import { useParams, Link } from 'react-router-dom';
import userService from '../services/userService';
import { getImageUrl, getTrips } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ProfilePage.css';
import ActivityHeatmap from '../components/common/ActivityHeatmap';
import TripTimeline from '../components/common/TripTimeline';
import BadgeIcon, { badgeInfoMap } from '../components/common/BadgeIcon';
import { format, isSameDay, isBefore } from 'date-fns';

const MemoizedActivityHeatmap = memo(ActivityHeatmap);

const ProfilePage = () => {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memberTrips, setMemberTrips] = useState([]);
  const [statsOverride, setStatsOverride] = useState(null);
  const [highlightedDates, setHighlightedDates] = useState([]); // For heatmap highlighting

  const itemsRef = useRef(new Map()); // Map to store refs for timeline cards

  const isOwnProfile = !username || (currentUser && profile && currentUser.username === profile.username);

  // Callback to register refs for timeline cards
  const registerRef = useCallback((id, node) => {
    if (node) {
      itemsRef.current.set(id, node);
    } else {
      itemsRef.current.delete(id);
    }
  }, []);

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

  useEffect(() => {
    const loadMemberTrips = async () => {
      if (!profile?.id) {
        setMemberTrips([]);
        return;
      }
      try {
        const trips = await getTrips({ user_id: profile.id });
        setMemberTrips(trips || []);
      } catch (err) {
        console.error('Failed to fetch member trips', err);
        setMemberTrips([]);
      }
    };

    loadMemberTrips();
  }, [profile?.id]);

  useEffect(() => {
    let isActive = true;
    const loadStats = async () => {
      if (!isOwnProfile || !profile) {
        setStatsOverride(null);
        return;
      }
      try {
        const stats = await userService.getStats();
        if (isActive) {
          setStatsOverride(stats);
        }
      } catch (err) {
        console.error('Failed to fetch user stats', err);
      }
    };

    loadStats();
    return () => {
      isActive = false;
    };
  }, [isOwnProfile, profile]);

  const activityData = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const normalizeDate = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
    };

    const uniqueTrips = new Map();
    (memberTrips || []).forEach((trip) => {
      if (trip?.id && !uniqueTrips.has(trip.id)) {
        uniqueTrips.set(trip.id, trip);
      }
    });
    (profile?.pinned_trips || []).forEach((trip) => {
      if (trip?.id && !uniqueTrips.has(trip.id)) {
        uniqueTrips.set(trip.id, trip);
      }
    });

    const entries = [];
    uniqueTrips.forEach((trip) => {
      const startDate = normalizeDate(
        trip.activity_start_date || trip.start_date || trip.created_at
      );
      if (!startDate) return;
      const candidateEnd = normalizeDate(
        trip.activity_end_date || trip.end_date
      ) || startDate;
      const start = startDate <= candidateEnd ? startDate : candidateEnd;
      const end = startDate <= candidateEnd ? candidateEnd : startDate;
      const totalDistance = Number(trip.stats?.distance_km) || 0;
      const dayCount = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
      const perDayValue = totalDistance > 0 ? totalDistance / dayCount : 1;

      for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
        entries.push({
          date: cursor.toISOString().split('T')[0],
          value: perDayValue,
          metadata: [{ tripId: trip.id, tripName: trip.name }],
        });
      }
    });

    return entries;
  }, [memberTrips, profile?.pinned_trips]);

  const recentTrips = useMemo(() => {
    return (memberTrips || [])
      .sort((a, b) => new Date(b.start_date || b.created_at) - new Date(a.start_date || a.created_at))
      .slice(0, 5); // Limit to 5 recent trips
  }, [memberTrips]);

  const handleHeatmapCellClick = useCallback((dateKey, metadata) => {
    if (metadata && metadata.length > 0) {
      const firstTripId = metadata[0].tripId;
      const node = itemsRef.current.get(firstTripId);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  const handleTripCardHover = useCallback((tripId, startDate, endDate) => {
    const dates = [];
    let current = startDate;
    while (isBefore(current, endDate) || isSameDay(current, endDate)) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = new Date(current.setDate(current.getDate() + 1));
    }
    setHighlightedDates(dates);
  }, []);

  const handleTripCardLeave = useCallback(() => {
    setHighlightedDates([]);
  }, []);

  // Determine latest trip cover image for header background
  const latestTripCoverImage = useMemo(() => {
    if (recentTrips.length > 0 && recentTrips[0].cover_image_url) {
      return recentTrips[0].cover_image_url.startsWith('http')
        ? recentTrips[0].cover_image_url
        : getImageUrl(recentTrips[0].cover_image_url);
    }
    return null;
  }, [recentTrips]);

  useEffect(() => {
    if (latestTripCoverImage) {
      document.documentElement.style.setProperty(
        '--profile-header-bg-image',
        `url(${latestTripCoverImage})`
      );
    } else {
      document.documentElement.style.removeProperty('--profile-header-bg-image');
    }
  }, [latestTripCoverImage]);


  if (loading) return <div className="profile-loading">Loading profile...</div>;
  if (error) return <div className="profile-error">{error}</div>;
  if (!profile) return <div className="profile-not-found">User not found.</div>;

  const statsSource = statsOverride || profile;
  
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
          <span className="stat-value">{statsSource?.total_trips || 0}</span>
          <span className="stat-label">Trips</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{(statsSource?.total_distance_km || 0).toFixed(1)} km</span>
          <span className="stat-label">Distance</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{(statsSource?.total_elevation_gain_m || 0).toFixed(0)} m</span>
          <span className="stat-label">Elevation</span>
        </div>
      </div>

      <MemoizedActivityHeatmap 
        data={activityData} 
        onCellClick={handleHeatmapCellClick} 
        highlightedDates={highlightedDates} 
      />

      <div className="profile-section">
        <div className="section-header">
          <h3>Recent Activity</h3>
          <Link to="/trips" className="view-all-link">View Full Log &rarr;</Link>
        </div>
        <TripTimeline
          trips={recentTrips}
          onCardHover={handleTripCardHover}
          onCardLeave={handleTripCardLeave}
          registerRef={registerRef}
        />
      </div>

      {/* Placeholder for Badges/Achievements */}
      <div className="profile-section">
        <h3>Achievements</h3>
        <div className="badges-grid">
          {statsSource?.earned_badges && statsSource.earned_badges.length > 0 ? (
            statsSource.earned_badges.map(badge => (
              <div key={badge} className="badge-item">
                <BadgeIcon badgeId={badge} size="1.2em" />
                <span className="badge-name">{badgeInfoMap[badge]?.name || badge}</span>
              </div>
            ))
          ) : (
            <p className="no-data">No badges earned yet.</p>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProfilePage;
