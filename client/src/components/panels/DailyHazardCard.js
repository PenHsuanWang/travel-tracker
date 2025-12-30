import React from 'react';

const DailyHazardCard = ({ dailyCheckpoints }) => {
  // Filter hazards that have a difficulty grade
  const hazards = dailyCheckpoints.filter(cp => 
    cp.properties?.semantic_type === 'hazard' && 
    cp.properties?.difficulty_grade
  );

  if (hazards.length === 0) {
    return null;
  }

  const getIcon = (subtype) => {
    if (subtype === 'rock_climbing') return '🧗';
    if (subtype === 'river_tracing') return '🌊';
    return '⚠️';
  };

  return (
    <div className="daily-hazard-card bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3">
      <div className="text-xs font-semibold text-center mb-2 text-gray-700">Hazard Statistic</div>
      
      <div className="hazard-list flex flex-col gap-1">
        {hazards.map(hazard => (
          <div key={hazard.id} className="hazard-item flex items-center text-xs text-gray-800">
            <span className="mr-2 text-base">
              {getIcon(hazard.properties?.hazard_subtype)}
            </span>
            <div className="flex-1">
              <span className="font-medium">{hazard.properties?.name || 'Hazard'}</span>
              {' : '}
              <span className="font-bold">{hazard.properties?.difficulty_grade}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyHazardCard;
