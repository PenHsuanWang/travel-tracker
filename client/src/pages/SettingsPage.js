import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import userService from '../services/userService';
import { getImageUrl } from '../services/api';
import '../styles/SettingsPage.css';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    location: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await userService.getProfile();
        setFormData({
          full_name: profile.full_name || '',
          bio: profile.bio || '',
          location: profile.location || '',
        });
        if (profile.avatar_url) {
            setPreviewUrl(profile.avatar_url.startsWith('http') ? profile.avatar_url : getImageUrl(profile.avatar_url));
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        setMessage({ type: 'error', text: 'Failed to load profile data.' });
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // 1. Upload avatar if changed
      if (avatarFile) {
        await userService.uploadAvatar(avatarFile);
      }

      // 2. Update profile data
      await userService.updateProfile(formData);

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      
      // Redirect back to profile after short delay
      setTimeout(() => {
        navigate('/profile/me');
      }, 1500);

    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-loading">Loading settings...</div>;

  return (
    <div className="settings-page">
      <h1>Edit Profile</h1>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-group avatar-section">
          <label>Profile Picture</label>
          <div className="avatar-preview">
            <img src={previewUrl || '/default-avatar.svg'} alt="Avatar Preview" />
          </div>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="file-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="full_name">Full Name</label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="Your Name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="City, Country"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="Tell us about yourself..."
            rows="4"
          />
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={() => navigate('/profile/me')}>
            Cancel
          </button>
          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
