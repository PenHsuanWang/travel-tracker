// client/src/components/panels/PlanToolbox.js
/**
 * PlanToolbox - Drawing tools panel for the plan canvas.
 * 
 * Provides a vertical toolbar with drawing tools: marker, polyline, rectangle, 
 * polygon, circle. Displays contextual action buttons during drawing.
 */
import React from 'react';
import './PlanToolbox.css';

// Tool definitions with SVG icons matching the design
const DRAWING_TOOLS = [
  {
    id: 'marker',
    label: 'Place Marker',
    hint: 'Click to place marker',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    ),
  },
  {
    id: 'polyline',
    label: 'Draw Polyline',
    hint: 'Click to add vertices, click existing marker to finish',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <polyline points="4 17 10 11 13 14 20 7"/>
        <circle cx="4" cy="17" r="1.5" fill="currentColor"/>
        <circle cx="10" cy="11" r="1.5" fill="currentColor"/>
        <circle cx="13" cy="14" r="1.5" fill="currentColor"/>
        <circle cx="20" cy="7" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'rectangle',
    label: 'Draw Rectangle',
    hint: 'Click to start, click to finish',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <rect x="3" y="5" width="18" height="14" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'polygon',
    label: 'Draw Polygon',
    hint: 'Click to add vertices, click first point to close',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>
        <circle cx="12" cy="2" r="1.5" fill="currentColor"/>
        <circle cx="22" cy="8.5" r="1.5" fill="currentColor"/>
        <circle cx="22" cy="15.5" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="22" r="1.5" fill="currentColor"/>
        <circle cx="2" cy="15.5" r="1.5" fill="currentColor"/>
        <circle cx="2" cy="8.5" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'circle',
    label: 'Draw Circle',
    hint: 'Click center, then click to set radius',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        <line x1="12" y1="12" x2="18" y2="12" strokeDasharray="2 2"/>
      </svg>
    ),
  },
];

const EDIT_TOOLS = [
  {
    id: 'edit',
    label: 'Edit Features',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    id: 'move',
    label: 'Move Features',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <polyline points="5 9 2 12 5 15"/>
        <polyline points="9 5 12 2 15 5"/>
        <polyline points="15 19 12 22 9 19"/>
        <polyline points="19 9 22 12 19 15"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <line x1="12" y1="2" x2="12" y2="22"/>
      </svg>
    ),
  },
  {
    id: 'cut',
    label: 'Cut Features',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <circle cx="6" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <line x1="20" y1="4" x2="8.12" y2="15.88"/>
        <line x1="14.47" y1="14.48" x2="20" y2="20"/>
        <line x1="8.12" y1="8.12" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'delete',
    label: 'Delete Features',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
        <line x1="18" y1="9" x2="12" y2="15"/>
        <line x1="12" y1="9" x2="18" y2="15"/>
      </svg>
    ),
  },
];

const PlanToolbox = ({ 
  activeTool, 
  onSelectTool, 
  disabled,
  isDrawing,
  drawingVertices,
  onFinishDrawing,
  onRemoveLastVertex,
  onCancelDrawing,
}) => {
  const handleToolClick = (toolId) => {
    if (disabled) return;
    if (activeTool === toolId) {
      onSelectTool(null);
    } else {
      onSelectTool(toolId);
    }
  };

  const activeToolInfo = [...DRAWING_TOOLS, ...EDIT_TOOLS].find((t) => t.id === activeTool);
  const canRemoveVertex = drawingVertices && drawingVertices > 0;
  const canFinish = drawingVertices && drawingVertices >= (activeTool === 'polygon' ? 3 : 2);

  return (
    <div className="plan-toolbox">
      {/* Drawing tools section */}
      <div className="toolbox-section">
        {DRAWING_TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`toolbox-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => handleToolClick(tool.id)}
            disabled={disabled}
            title={tool.label}
            aria-pressed={activeTool === tool.id}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="toolbox-divider" />

      {/* Edit tools section */}
      <div className="toolbox-section">
        {EDIT_TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`toolbox-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => handleToolClick(tool.id)}
            disabled={disabled}
            title={tool.label}
            aria-pressed={activeTool === tool.id}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* Drawing action buttons - shown when actively drawing */}
      {activeTool && (
        <div className="toolbox-actions">
          {isDrawing && (activeTool === 'polyline' || activeTool === 'polygon') && (
            <>
              {canFinish && (
                <button 
                  className="action-btn action-finish"
                  onClick={onFinishDrawing}
                  title="Finish drawing"
                >
                  Finish
                </button>
              )}
              {canRemoveVertex && (
                <button 
                  className="action-btn action-undo"
                  onClick={onRemoveLastVertex}
                  title="Remove last vertex"
                >
                  Remove Last Vertex
                </button>
              )}
            </>
          )}
          <button 
            className="action-btn action-cancel"
            onClick={onCancelDrawing || (() => onSelectTool(null))}
            title="Cancel"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tool hint */}
      {activeToolInfo && !isDrawing && (
        <div className="toolbox-hint">
          {activeToolInfo.hint || activeToolInfo.label}
        </div>
      )}
    </div>
  );
};

export default PlanToolbox;
