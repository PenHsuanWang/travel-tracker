import React from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../../services/api';
import './MemberCard.css';

const MemberCard = ({ user }) => {
  const avatarSrc = user.avatar_url 
    ? (user.avatar_url.startsWith('http') ? user.avatar_url : getImageUrl(user.avatar_url))
    : '/default-avatar.svg';

  return (
    <div className="member-card">
      <div className="member-avatar">
        <img 
          src={avatarSrc} 
          alt={user.username} 
          onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.svg'; }}
        />
      </div>
      <div className="member-info">
        <h3><Link to={`/profile/${user.username}`}>{user.username}</Link></h3>
        <p className="member-bio">{user.bio || 'No bio available'}</p>
        <div className="member-stats">
          <span>{user.total_trips || user.trip_count || 0} Trips</span>
          <span>•</span>
          <span>Joined {user.created_at ? new Date(user.created_at).getFullYear() : 'Unknown'}</span>
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
