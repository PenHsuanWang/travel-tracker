import React, { useState, useRef } from 'react';
import { createTrip, createTripWithGpx } from '../../services/api';
import './CreateTripModal.css'; // We'll create this CSS file next

const CreateTripModal = ({ isOpen, onClose, onTripCreated }) => {
    const [formData, setFormData] = useState({
        name: '',
        start_date: '',
        end_date: '',
        region: '',
        notes: ''
    });
    const [gpxFile, setGpxFile] = useState(null);
    const [gpxError, setGpxError] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setGpxFile(null);
            setGpxError('');
            return;
        }
        if (!file.name.toLowerCase().endsWith('.gpx')) {
            setGpxError('Only .gpx files are supported.');
            setGpxFile(null);
            return;
        }
        setGpxError('');
        setGpxFile(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setGpxError('');

        // Validate date ordering only when both are provided
        if (formData.start_date && formData.end_date) {
            const start = new Date(formData.start_date);
            const end = new Date(formData.end_date);
            if (start > end) {
                setLoading(false);
                setError("Start Date must be on or before End Date.");
                return;
            }
        }

        try {
            const payload = {
                ...formData,
                start_date: formData.start_date || null,
                end_date: formData.end_date || null
            };
            const response = gpxFile
                ? await createTripWithGpx(payload, gpxFile)
                : await createTrip(payload);

            const tripResult = response?.trip || response;

            let notice = '';
            if (response?.gpx_error) {
                notice = 'We could not process the GPX file. The trip was created without auto-filled dates.';
            } else if (response?.trip_dates_auto_filled) {
                notice = 'Trip dates were set from the uploaded GPX track (you can edit them later).';
            } else if (response?.gpx_metadata_extracted === false) {
                notice = 'We could not read dates from this GPX file. Please enter dates manually or continue without them.';
            }

            if (notice) {
                window.alert(notice); // eslint-disable-line no-alert
            }

            onTripCreated(tripResult);
            onClose();
            // Reset form
            setFormData({
                name: '',
                start_date: '',
                end_date: '',
                region: '',
                notes: ''
            });
            setGpxFile(null);
        } catch (err) {
            console.error("Failed to create trip:", err);
            let errorMessage = "Failed to create trip. Please try again.";
            if (err.response && err.response.data && err.response.data.detail) {
                const detail = err.response.data.detail;
                if (typeof detail === 'object' && detail.message) {
                    // Handle structured error from the backend
                    errorMessage = `${detail.message} (Details: ${detail.error_details || 'N/A'})`;
                } else {
                    // Handle simple string detail
                    errorMessage = `An error occurred: ${String(detail)}`;
                }
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Create New Trip</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Trip Name *</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="e.g., Summer Hike 2023"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="start_date">Start Date</label>
                            <input
                                type="date"
                                id="start_date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="end_date">End Date</label>
                            <input
                                type="date"
                                id="end_date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="region">Region</label>
                        <input
                            type="text"
                            id="region"
                            name="region"
                            value={formData.region}
                            onChange={handleChange}
                            placeholder="e.g., Alps, Rockies"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="notes">Notes</label>
                        <textarea
                            id="notes"
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="3"
                            placeholder="Any details about the trip..."
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="gpx_file">GPX File (optional)</label>
                        <div className="file-input-row">
                            <input
                                type="file"
                                id="gpx_file"
                                name="gpx_file"
                                accept=".gpx"
                                onChange={handleFileSelect}
                                ref={fileInputRef}
                            />
                            {gpxFile && <span className="file-name">{gpxFile.name}</span>}
                        </div>
                        {gpxError && <div className="info-message">{gpxError}</div>}
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="cancel-button" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="submit-button" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Trip'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTripModal;
