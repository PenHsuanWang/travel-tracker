import React, { useState, useEffect } from 'react';
import { updateTripMembers, getImageUrl } from '../../services/api';
import { updatePlanMembers } from '../../services/planService';
import userService from '../../services/userService';
import './ManageMembersModal.css';

const ManageMembersModal = ({ isOpen, onClose, entity, onEntityUpdated, type = 'trip' }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Backwards compatibility alias if "trip" prop passed instead of "entity"
    // (Though we will update caller, good for safety)
    const targetEntity = entity;

    useEffect(() => {
        if (targetEntity && targetEntity.members) {
            setSelectedMembers(targetEntity.members);
        } else {
            setSelectedMembers([]);
        }
    }, [targetEntity]);

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

    if (!isOpen || !targetEntity) return null;

    const handleAddMember = (user) => {
        if (!selectedMembers.find(m => m.id === user.id)) {
            setSelectedMembers(prev => [...prev, user]);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleRemoveMember = (userId) => {
        setSelectedMembers(prev => prev.filter(m => m.id !== userId));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const memberIds = selectedMembers.map(m => m.id).filter(id => id);
            
            let updatedEntity;
            if (type === 'plan') {
                updatedEntity = await updatePlanMembers(targetEntity.id, memberIds);
            } else {
                updatedEntity = await updateTripMembers(targetEntity.id, memberIds);
            }
            
            const optimisticEntity = {
                ...targetEntity,
                members: selectedMembers,
                member_ids: memberIds
            };
            
            if (onEntityUpdated) {
                onEntityUpdated(optimisticEntity);
            }
            onClose();
        } catch (err) {
            console.error("Failed to update members:", err);
            setError(`Failed to update ${type} members. Please try again.`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content manage-members-modal">
                <div className="modal-header">
                    <h2>Manage {type === 'plan' ? 'Plan' : 'Trip'} Members</h2>
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
                        <p className="helper-text" style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
                            {type === 'plan' 
                                ? "Contributors can add markers and edit logistics. Only the Owner can delete the plan or manage members."
                                : "Contributors can upload photos and edit journal notes. Only the Owner can delete the trip or manage members."
                            }
                        </p>
                        
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
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManageMembersModal;
