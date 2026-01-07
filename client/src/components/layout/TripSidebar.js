import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../../services/api';
import ImageGalleryPanel from '../panels/ImageGalleryPanel';
import ManageMembersModal from '../common/ManageMembersModal';
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

const TripSummaryCard = ({ trip, stats, onManageMembers, isOwner }) => {
    if (!trip) {
        return (
            <div className="TripSummaryCard">
                <p>Loading trip details…</p>
            </div>
        );
    }

    const start = formatDate(trip.start_date);
    const end = formatDate(trip.end_date);
    
    // Separate owner from members list if present
    const owner = trip.owner;
    const members = (trip.members || []).filter(m => !owner || m.id !== owner.id);

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
            
            {/* Owner Section */}
            {owner && (
                <div className="trip-members-section">
                    <p className="section-label">Organizer</p>
                    <Link to={`/profile/${owner.username}`} className="member-item-link">
                        <div className="member-item" title={`Organizer: ${owner.username}`}>
                            <img 
                                src={owner.avatar_url ? (owner.avatar_url.startsWith('http') ? owner.avatar_url : getImageUrl(owner.avatar_url)) : '/default-avatar.svg'} 
                                alt={owner.username} 
                                className="member-avatar owner-avatar"
                            />
                            <span className="member-name">{owner.username}</span>
                        </div>
                    </Link>
                </div>
            )}

            {/* Members Section */}
            <div className="trip-members-section">
                <div className="section-header-row">
                    <p className="section-label">Members</p>
                    {isOwner && (
                        <button 
                            className="icon-button-small" 
                            onClick={onManageMembers}
                            title="Manage members"
                        >
                            +
                        </button>
                    )}
                </div>
                <div className="members-list">
                    {members.map(member => (
                        <div key={member.id} className="member-item" title={member.username}>
                            <img 
                                src={member.avatar_url ? (member.avatar_url.startsWith('http') ? member.avatar_url : getImageUrl(member.avatar_url)) : '/default-avatar.svg'} 
                                alt={member.username} 
                                className="member-avatar"
                            />
                            <span className="member-name">{member.username}</span>
                        </div>
                    ))}
                    {members.length === 0 && (
                        <p className="empty-members-text">No other members</p>
                    )}
                </div>
            </div>

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
    readOnly,
    isOwner
}) {
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

    const handleTripUpdated = (updatedTrip) => {
        onTripDataChange({ trip: updatedTrip });
    };

    return (
        <aside className="Sidebar">
            <TripSummaryCard 
                trip={trip} 
                stats={stats} 
                onManageMembers={() => setIsMemberModalOpen(true)}
                isOwner={isOwner}
            />
            {notice && (
                <div className="TripNotice" role="status">
                    {notice}
                </div>
            )}

            <ImageGalleryPanel tripId={tripId} onDataChange={onTripDataChange} readOnly={readOnly} />
            
            <ManageMembersModal
                isOpen={isMemberModalOpen}
                onClose={() => setIsMemberModalOpen(false)}
                entity={trip}
                onEntityUpdated={handleTripUpdated}
                type="trip"
            />
        </aside>
    );
}

export default TripSidebar;
