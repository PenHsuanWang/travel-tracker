import React, { useState, useEffect } from 'react';
import { updateTripMembers, getImageUrl } from '../../services/api';
import userService from '../../services/userService';
import './ManageMembersModal.css';

const ManageMembersModal = ({ isOpen, onClose, trip, onTripUpdated }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (trip && trip.members) {
            setSelectedMembers(trip.members);
        } else {
            setSelectedMembers([]);
        }
    }, [trip]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setSearching(true);
                try {
                    const results = await userService.searchUsers(searchQuery);
                    setSearchResults(results);
                } catch (err) {
                    console.error("Search failed", err);
                } finally {
                    setSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    if (!isOpen || !trip) return null;

    const handleAddMember = (user) => {
        if (!selectedMembers.find(m => m.id === user.id)) {
            setSelectedMembers(prev => [...prev, user]);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleRemoveMember = (userId) => {
        // Don't allow removing the owner if they are in the list (though usually owner is separate)
        // But if the owner is in the members list, we should probably prevent removal or backend handles it.
        // Backend `update_members` ensures owner is kept.
        setSelectedMembers(prev => prev.filter(m => m.id !== userId));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const memberIds = selectedMembers.map(m => m.id);
            const updatedTrip = await updateTripMembers(trip.id, memberIds);
            
            // The updatedTrip from backend might not have full member objects populated immediately 
            // depending on the return type of updateTrip (it returns Trip, not TripResponse usually).
            // But our service `update_trip` returns `Trip` object.
            // We might need to manually construct the payload for the parent or re-fetch.
            // For now, let's pass the selectedMembers back to update the UI optimistically.
            
            const optimisticTrip = {
                ...trip,
                members: selectedMembers,
                member_ids: memberIds
            };
            
            onTripUpdated(optimisticTrip);
            onClose();
        } catch (err) {
            console.error("Failed to update members:", err);
            setError("Failed to update members. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content manage-members-modal">
                <div className="modal-header">
                    <h2>Manage Trip Members</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Add Members</label>
                        <div className="member-search-container">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users by name..."
                                className="member-search-input"
                            />
                            {searchResults.length > 0 && (
                                <div className="search-results-dropdown">
                                    {searchResults.map(user => (
                                        <div 
                                            key={user.id} 
                                            className="search-result-item"
                                            onClick={() => handleAddMember(user)}
                                        >
                                            <img 
                                                src={user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : getImageUrl(user.avatar_url)) : '/default-avatar.svg'} 
                                                alt="" 
                                                className="result-avatar"
                                            />
                                            <span>{user.username}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="selected-members-list">
                            {selectedMembers.length === 0 && <p className="no-members-text">No members yet.</p>}
                            {selectedMembers.map(member => (
                                <div key={member.id} className="selected-member-chip">
                                    <img 
                                        src={member.avatar_url ? (member.avatar_url.startsWith('http') ? member.avatar_url : getImageUrl(member.avatar_url)) : '/default-avatar.svg'} 
                                        alt="" 
                                        className="chip-avatar"
                                    />
                                    <span>{member.username}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveMember(member.id)}
                                        className="remove-member-btn"
                                        title="Remove member"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                </div>

                <div className="modal-actions">
                    <button type="button" className="cancel-button" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="button" className="submit-button" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManageMembersModal;
