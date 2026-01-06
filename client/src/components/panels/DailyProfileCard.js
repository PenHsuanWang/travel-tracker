import React from 'react';
import { differenceInMinutes } from 'date-fns';
import { ICON_CONFIG } from '../../utils/mapIcons';

/**
 * DailyProfileCard
 * Visualizes a simplified timeline strip for a day's journey.
 * 
 * PRD v1.1 - Unified Marker System:
 * Shows only essential nodes: Start -> [Water/Hazard] -> End
 * - Water (💧): Critical for hydration planning
 * - Hazard (⚠️): Safety-critical waypoints
 * 
 * Note: Camp is excluded from the profile strip (handled in itinerary)
 * but total duration still includes ALL scheduled items.
 */

// Types that appear in the simplified profile (besides Start/End)
const PROFILE_VISIBLE_TYPES = new Set(['water', 'hazard', 'camp']);

const DailyProfileCard = ({ dailyCheckpoints }) => {
  if (!dailyCheckpoints || dailyCheckpoints.length < 2) {
    return (
       <div className="daily-profile-card bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3">
         <div className="text-xs text-gray-400 text-center italic">Add scheduled markers to see daily profile.</div>
       </div>
    );
  }

  // 1. Filter Key Nodes for visualization
  // PRD v1.1: Only Start, End, Water, Hazard appear in the strip
  const keyNodes = [];
  dailyCheckpoints.forEach((cp, index) => {
      const isStart = index === 0;
      const isEnd = index === dailyCheckpoints.length - 1;
      const type = cp.properties?.semantic_type;
      
      // Include Start, End, and only Water/Hazard semantic types
      if (isStart || isEnd || PROFILE_VISIBLE_TYPES.has(type)) {
          keyNodes.push(cp);
      }
  });

  // Helper: Get formatted duration string
  const getDiffStr = (dateA, dateB) => {
      if (!dateA || !dateB) return '--';
      const d1 = new Date(dateA);
      const d2 = new Date(dateB);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '--';

      const diffMins = differenceInMinutes(d2, d1);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (hours > 0) return `${hours}h${mins}m`;
      return `${mins}m`;
  };

  // Helper: Get Icon
  const getIcon = (node, index, total) => {
      const type = node.properties?.semantic_type;
      
      // If it has a specific config, use it
      if (type && ICON_CONFIG[type]) {
          return ICON_CONFIG[type].emoji;
      }
      
      // Fallbacks for Start/End
      if (index === 0) return '🟢'; // Start
      if (index === total - 1) return '🔴'; // End
      
      return '📍';
  };

  // Total duration uses original checkpoint list (includes ALL items, not just visible)
  const startNode = dailyCheckpoints[0];
  const endNode = dailyCheckpoints[dailyCheckpoints.length - 1];
  const totalDurationStr = getDiffStr(startNode.properties?.estimated_arrival, endNode.properties?.estimated_arrival);

  return (
    <div className="daily-profile-card bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3">
      <div className="text-xs font-semibold text-center mb-3 text-gray-700">Today's Profile</div>
      
      <div className="profile-scroll-wrapper overflow-x-auto pb-2" data-testid="profile-scroll-wrapper">
        <div className="profile-viz flex items-center min-w-full w-max text-xs text-gray-500 px-1">
        {keyNodes.map((node, i) => {
          const isLast = i === keyNodes.length - 1;
          
          let duration = null;
          if (!isLast) {
             const nextNode = keyNodes[i+1];
             duration = getDiffStr(node.properties?.estimated_arrival, nextNode.properties?.estimated_arrival);
          }

          return (
            <React.Fragment key={node.id || i}>
              {/* Node Icon */}
              <div className="node-icon flex flex-col items-center z-10 flex-shrink-0" title={node.properties?.name || 'Checkpoint'}>
                 <span className="text-sm" role="img" aria-label="node">{getIcon(node, i, keyNodes.length)}</span> 
              </div>

              {/* Connecting Line Segment */}
              {!isLast && (
                  <div className="segment flex flex-col items-center mx-1 relative flex-shrink-0 min-w-[60px]">
                     {/* Duration Label Floating Above Line */}
                     <span className="mb-1 font-medium text-gray-800 whitespace-nowrap" style={{fontSize: '10px'}}>{duration}</span>
                     {/* Dashed Line */}
                     <div className="w-full border-b-2 border-dashed border-gray-300"></div>
                  </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      </div>

      {/* Footer Stats */}
      <div className="text-center text-xs mt-3 pt-2 border-t border-gray-100 font-mono text-gray-600">
        Estimate total time: <span className="font-bold text-gray-900">{totalDurationStr}</span>
      </div>
    </div>
  );
};

export default DailyProfileCard;
