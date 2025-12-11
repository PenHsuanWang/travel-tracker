import React, { useState, useRef, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Camera, MapPin, Link as LinkIcon, Trash2, Check, X, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- TimelineItem Sub-component ---

const TimelineItem = ({ item, index, onUpdate, onDelete, onClick, onHover, readOnly }) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const deriveTitle = () => item.noteTitle || item.title || (item.type === 'waypoint' ? 'Waypoint' : 'Untitled Photo');

    const [titleValue, setTitleValue] = useState(deriveTitle());
    const [noteValue, setNoteValue] = useState(item.note || '');
    
    const titleInputRef = useRef(null);
    const noteInputRef = useRef(null);

    // Sync local state with props when they change (e.g. from map update)
    useEffect(() => {
        setTitleValue(deriveTitle());
    }, [item.title, item.noteTitle]);

    useEffect(() => {
        setNoteValue(item.note || '');
    }, [item.note]);

    // Auto-focus inputs
    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
        }
    }, [isEditingTitle]);

    useEffect(() => {
        if (isEditingNote && noteInputRef.current) {
            noteInputRef.current.focus();
        }
    }, [isEditingNote]);

    const handleTitleSave = async () => {
        if (isSaving) return;
        
        const trimmedTitle = titleValue.trim();
        if (trimmedTitle !== (item.title || '')) {
            setIsSaving(true);
            try {
                const payload = {
                    itemType: item.type,
                    noteTitle: trimmedTitle,
                    note: item.note, // Preserve existing note
                };
                if (item.type === 'waypoint') {
                    payload.waypointId = item.id;
                    payload.gpxMetadataId = item.gpxMetadataId;
                    payload.waypointIndex = item.waypointIndex;
                } else {
                    payload.photoId = item.id;
                    payload.metadataId = item.metadataId;
                }
                await onUpdate(payload);
            } catch (error) {
                console.error("Failed to save title:", error);
                // Optionally revert or show error
                setTitleValue(item.title || '');
            } finally {
                setIsSaving(false);
            }
        }
        setIsEditingTitle(false);
    };
    
    const handleTitleCancel = () => {
        setTitleValue(deriveTitle());
        setIsEditingTitle(false);
    };

    const handleNoteSave = async () => {
        if (isSaving) return;
        
        if (noteValue !== (item.note || '')) {
            setIsSaving(true);
            try {
                const payload = {
                    itemType: item.type,
                    note: noteValue,
                    noteTitle: item.noteTitle || item.title, // Preserve existing title
                };
                if (item.type === 'waypoint') {
                    payload.waypointId = item.id;
                    payload.gpxMetadataId = item.gpxMetadataId;
                    payload.waypointIndex = item.waypointIndex;
                } else {
                    payload.photoId = item.id;
                    payload.metadataId = item.metadataId;
                }
                await onUpdate(payload);
            } catch (error) {
                console.error("Failed to save note:", error);
                setNoteValue(item.note || '');
            } finally {
                setIsSaving(false);
            }
        }
        setIsEditingNote(false);
    };

    const handleNoteCancel = () => {
        setNoteValue(item.note || '');
        setIsEditingNote(false);
    };

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Escape') {
            handleTitleCancel();
        } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            handleTitleSave();
        }
    };

    const handleNoteKeyDown = (e) => {
        if (e.key === 'Escape') {
            handleNoteCancel();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleNoteSave();
        }
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this item?')) {
            onDelete(item.id);
        }
    };

    // Helper to format date+time for view mode timestamp
    const formatFullDateTime = (timestamp) => {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${year}/${month}/${day} ${ampm} ${displayHours}:${minutes}`;
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

    const getDefaultTitle = () => deriveTitle();

    return (
        <div
            id={`timeline-item-${item.id}`}
            className="relative pl-8 animate-fade-in-up group"
            style={{ animationDelay: `${index * 30}ms` }}
            onMouseEnter={() => onHover && onHover(item.id, true)}
            onMouseLeave={() => onHover && onHover(item.id, false)}
        >
            {/* Row 1: Header Row */}
            <div className="flex items-center mb-2">
                {/* Node Icon */}
                <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center z-10 ${getIconStyles()}`}>
                    {getIcon()}
                </div>

                {/* Time Label */}
                <span className="text-sm font-medium text-slate-500 mr-auto">
                    {formatFullDateTime(item.timestamp)}
                </span>
                
                {/* Delete Button (Visible on Hover) */}
                {!readOnly && onDelete && (
                    <button 
                        onClick={handleDelete}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50"
                        title="Delete item"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            {/* Row 2: Content Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all duration-200 p-4">
                
                {/* Title Section */}
                <div className="mb-1 min-h-[24px]">
                    {!readOnly && isEditingTitle ? (
                        <div>
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={titleValue}
                                onChange={(e) => setTitleValue(e.target.value)}
                                onKeyDown={handleTitleKeyDown}
                                className="w-full px-2 py-1 text-base font-semibold text-slate-800 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                placeholder="Title"
                            />
                            <div className="flex items-center justify-end mt-2 space-x-2">
                                <button
                                    onClick={handleTitleCancel}
                                    className="px-3 py-1 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTitleSave}
                                    disabled={isSaving}
                                    className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center"
                                >
                                    {isSaving ? (
                                        <><Loader size={14} className="animate-spin mr-2" /> Saving...</>
                                    ) : (
                                        'Save'
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <h3 
                            className={`font-semibold text-slate-800 ${!readOnly ? 'cursor-text hover:text-indigo-600' : ''}`}
                            onClick={() => !readOnly && setIsEditingTitle(true)}
                            title={!readOnly ? "Click to edit title" : ""}
                        >
                            {getDefaultTitle()}
                        </h3>
                    )}
                </div>

                {/* Subtitle */}
                <p className="text-xs text-slate-500 mb-3">
                    {item.type === 'waypoint'
                        ? `Elevation: ${item.elevation || 0}m`
                        : formatDate(item.timestamp)
                    }
                </p>

                {/* Photo Display (Click to View) */}
                {item.type === 'photo' && (item.thumbnailUrl || item.imageUrl) && (
                    <div 
                        className="w-[90%] mx-auto my-3 overflow-hidden rounded-lg shadow-sm cursor-pointer relative group/image"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick(item);
                        }}
                    >
                        <img
                            src={item.thumbnailUrl || item.imageUrl}
                            alt={item.title || 'Memory'}
                            className="w-full h-auto object-cover transition-transform duration-300 group-hover/image:scale-105"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover/image:bg-opacity-10 transition-opacity flex items-center justify-center">
                            {/* Optional: Add a zoom icon on hover if desired */}
                        </div>
                    </div>
                )}

                {/* Note Body */}
                <div className="text-sm mt-2 min-h-[20px]">
                    {!readOnly && isEditingNote ? (
                        <div>
                            <textarea
                                ref={noteInputRef}
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                onKeyDown={handleNoteKeyDown}
                                rows={4}
                                className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y bg-white"
                                placeholder="Add a note..."
                            />
                            <div className="flex items-center justify-end mt-2 space-x-2">
                                <button
                                    onClick={handleNoteCancel}
                                    className="px-3 py-1 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleNoteSave}
                                    disabled={isSaving}
                                    className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center"
                                >
                                    {isSaving ? (
                                        <><Loader size={14} className="animate-spin mr-2" /> Saving...</>
                                    ) : (
                                        'Save'
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            className={`prose prose-sm max-w-none ${!readOnly ? 'cursor-text hover:bg-slate-50 rounded p-1 -m-1 transition-colors' : ''}`}
                            onClick={() => !readOnly && setIsEditingNote(true)}
                            title={!readOnly ? "Click to edit note" : ""}
                        >
                            {item.note ? (
                                <div className="text-green-600 font-medium">
                                    <ReactMarkdown>{item.note}</ReactMarkdown>
                                </div>
                            ) : (
                                <span className="italic text-slate-400 text-xs">
                                    {readOnly ? 'No notes added...' : 'Add a note...'}
                                </span>
                            )}
                        </div>
                    )}
                </div>
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
    onHover: PropTypes.func,
    readOnly: PropTypes.bool,
};

// --- Main Component: TimelinePanel ---

const TimelinePanel = ({
    items,
    scrollToItemId,
    onAddPhoto,
    onAddUrl,
    onUpdateItem,
    onDeleteItem,
    onItemClick,
    onItemHover,
    readOnly
}) => {
    const fileInputRef = useRef(null);
    const [activeEditItemId, setActiveEditItemId] = useState(null);

    // Scroll to item when scrollToItemId changes
    useEffect(() => {
        if (scrollToItemId) {
            const element = document.getElementById(`timeline-item-${scrollToItemId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Optional: Add a temporary highlight effect
                element.classList.add('bg-yellow-50', 'transition-colors', 'duration-1000');
                setTimeout(() => {
                    element.classList.remove('bg-yellow-50');
                }, 2000);
            }
        }
    }, [scrollToItemId]);

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
                {!readOnly && (
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
                )}
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
                                    onHover={onItemHover}
                                    readOnly={readOnly}
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
    scrollToItemId: PropTypes.string,
    onAddPhoto: PropTypes.func,
    onAddUrl: PropTypes.func,
    onUpdateItem: PropTypes.func,
    onDeleteItem: PropTypes.func,
    onItemClick: PropTypes.func,
    onItemHover: PropTypes.func,
};

export default TimelinePanel;
