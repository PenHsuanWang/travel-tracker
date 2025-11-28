import React, { useState, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Camera, MapPin, PenLine, Link as LinkIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- TimelineItem Sub-component ---

const TimelineItem = ({ item, index, onUpdate, onDelete, onClick }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        title: item.title || '',
        timestamp: new Date(item.timestamp || Date.now()).toISOString().slice(0, 16), // Format for datetime-local
        note: item.note || '',
    });

    const handleEditToggle = (e) => {
        e.stopPropagation();
        setIsEditing(!isEditing);
        if (!isEditing) {
            // Reset form when entering edit mode
            setEditForm({
                title: item.title || '',
                timestamp: new Date(item.timestamp).toISOString().slice(0, 16),
                note: item.note || '',
            });
        }
    };

    const handleSave = (e) => {
        e.stopPropagation();
        const updatedTimestamp = new Date(editForm.timestamp).getTime();
        onUpdate(item.id, {
            ...editForm,
            timestamp: updatedTimestamp,
        });
        setIsEditing(false);
    };

    const handleCancel = (e) => {
        e.stopPropagation();
        setIsEditing(false);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this item?')) {
            onDelete(item.id);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    // Helper to format time
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Helper to format date for photo subtitle
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const getIcon = () => {
        if (item.type === 'photo') return <Camera size={16} />;
        if (item.type === 'waypoint') return <MapPin size={16} />;
        return null;
    };

    const getIconStyles = () => {
        if (item.type === 'photo') return 'border-emerald-500 text-emerald-600';
        if (item.type === 'waypoint') return 'border-amber-500 text-amber-600';
        return 'border-gray-500 text-gray-600';
    };

    const getDefaultTitle = () => {
        if (item.title) return item.title;
        return item.type === 'waypoint' ? 'Waypoint' : 'Untitled Photo';
    };

    return (
        <div
            className="relative pl-8 animate-fade-in-up"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            {/* Row 1: Header Row */}
            <div className="flex items-center mb-2">
                {/* Node Icon */}
                <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center z-10 ${getIconStyles()}`}>
                    {getIcon()}
                </div>

                {/* Time Label */}
                <span className="text-sm font-medium text-slate-500 mr-auto">
                    {formatTime(item.timestamp)}
                </span>

                {/* Edit Button */}
                <button
                    onClick={handleEditToggle}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Edit item"
                >
                    <PenLine size={14} />
                </button>
            </div>

            {/* Row 2: Content Card */}
            <div
                className={`bg-white rounded-xl border transition-all duration-200 ${isEditing
                    ? 'ring-2 ring-indigo-200 border-indigo-300 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
            >
                {isEditing ? (
                    // Edit Mode
                    <div className="p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
                            <input
                                type="text"
                                name="title"
                                value={editForm.title}
                                onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Title"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Time</label>
                            <input
                                type="datetime-local"
                                name="timestamp"
                                value={editForm.timestamp}
                                onChange={handleChange}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Note</label>
                            <textarea
                                name="note"
                                value={editForm.note}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                placeholder="Add a note..."
                            />
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            {onDelete && (
                                <button
                                    onClick={handleDelete}
                                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors mr-auto"
                                >
                                    Delete
                                </button>
                            )}
                            <button
                                onClick={handleCancel}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    // View Mode
                    <div className="p-4 cursor-pointer" onClick={() => onClick(item)}>
                        {/* Title */}
                        <h3 className="font-semibold text-slate-800 mb-1">
                            {getDefaultTitle()}
                        </h3>

                        {/* Subtitle */}
                        <p className="text-xs text-slate-500 mb-3">
                            {item.type === 'waypoint'
                                ? `Elevation: ${item.elevation || 0}m`
                                : formatDate(item.timestamp)
                            }
                        </p>

                        {/* Photo Display */}
                        {item.type === 'photo' && (item.thumbnailUrl || item.imageUrl) && (
                            <div className="w-[90%] mx-auto my-3 overflow-hidden rounded-lg shadow-sm">
                                <img
                                    src={item.thumbnailUrl || item.imageUrl}
                                    alt={item.title || 'Memory'}
                                    className="w-full h-auto object-cover transition-transform duration-300 hover:scale-105"
                                />
                            </div>
                        )}

                        {/* Note Body */}
                        <div className="text-sm text-slate-600 mt-2 prose prose-sm max-w-none">
                            {item.note ? (
                                <ReactMarkdown>{item.note}</ReactMarkdown>
                            ) : (
                                <span className="italic text-slate-400 text-xs">No notes added...</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

TimelineItem.propTypes = {
    item: PropTypes.shape({
        id: PropTypes.string.isRequired,
        type: PropTypes.oneOf(['photo', 'waypoint']).isRequired,
        timestamp: PropTypes.number.isRequired,
        title: PropTypes.string,
        elevation: PropTypes.number,
        imageUrl: PropTypes.string,
        thumbnailUrl: PropTypes.string,
        note: PropTypes.string,
    }).isRequired,
    index: PropTypes.number.isRequired,
    onUpdate: PropTypes.func.isRequired,
    onDelete: PropTypes.func,
    onClick: PropTypes.func.isRequired,
};

// --- Main Component: TimelinePanel ---

const TimelinePanel = ({
    items,
    onAddPhoto,
    onAddUrl,
    onUpdateItem,
    onDeleteItem,
    onItemClick
}) => {
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            if (onAddPhoto) {
                onAddPhoto(e.target.files);
            }
        }
        // Reset input so same files can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => a.timestamp - b.timestamp);
    }, [items]);

    return (
        <div className="h-full flex flex-col bg-slate-50 p-6 overflow-hidden">
            {/* Header Section (Memories Header) */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Memories</h1>
                    <p className="text-sm text-slate-500">Capture your journey</p>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={onAddUrl}
                        className="flex items-center px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
                    >
                        <LinkIcon size={16} className="mr-2" />
                        Add URL
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center px-3 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Camera size={16} className="mr-2" />
                        Add Photos
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />
                </div>
            </div>

            {/* Main Body Section (Journey Log) */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-700">Journey Log</h2>
                    <span className="px-2.5 py-0.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-full">
                        {items.length}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    <div className="relative border-l-2 border-slate-200 ml-4 pb-10 space-y-8">
                        {sortedItems.length > 0 ? (
                            sortedItems.map((item, index) => (
                                <TimelineItem
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    onUpdate={onUpdateItem}
                                    onDelete={onDeleteItem}
                                    onClick={onItemClick}
                                />
                            ))
                        ) : (
                            <div className="pl-8 py-8 text-slate-400 text-sm italic">
                                No memories recorded yet. Start by adding photos or waypoints.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

TimelinePanel.propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        type: PropTypes.oneOf(['photo', 'waypoint']).isRequired,
        timestamp: PropTypes.number.isRequired,
        title: PropTypes.string,
        elevation: PropTypes.number,
        imageUrl: PropTypes.string,
        thumbnailUrl: PropTypes.string,
        note: PropTypes.string,
    })).isRequired,
    onAddPhoto: PropTypes.func,
    onAddUrl: PropTypes.func,
    onUpdateItem: PropTypes.func,
    onDeleteItem: PropTypes.func,
    onItemClick: PropTypes.func,
};

export default TimelinePanel;
