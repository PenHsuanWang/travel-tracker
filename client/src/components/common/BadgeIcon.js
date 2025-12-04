import React from 'react';
import { FaHiking, FaMountain, FaTrophy, FaMedal, FaStar, FaAward, FaGlobe } from 'react-icons/fa'; // Example icons

export const badgeInfoMap = { // Changed to export const
  "hiker-level-1": { icon: FaHiking, color: "#68d391", name: "Beginner Hiker" }, // Green
  "hiker-level-2": { icon: FaHiking, color: "#38b2ac", name: "Intermediate Hiker" }, // Teal
  "hiker-level-3": { icon: FaMountain, color: "#2c5282", name: "Advanced Hiker" }, // Dark Blue
  "climber-level-1": { icon: FaTrophy, color: "#f6e05e", name: "Beginner Climber" }, // Yellow
  "climber-level-2": { icon: FaMedal, color: "#ed8936", name: "Intermediate Climber" }, // Orange
  "climber-level-3": { icon: FaStar, color: "#c53030", name: "Advanced Climber" }, // Red
  "first-trip": { icon: FaGlobe, color: "#a0aec0", name: "First Trip" }, // Gray
  "explorer": { icon: FaAward, color: "#a55eea", name: "Explorer" }, // Purple
  // Add more mappings as needed from backend achievement definitions
};

const BadgeIcon = ({ badgeId, size = "1.5em", className = "" }) => {
  const badgeInfo = badgeInfoMap[badgeId];

  if (!badgeInfo) {
    // Default or unknown badge icon
    return <FaStar size={size} color="#a0aec0" title={badgeId} className={className} />;
  }

  const IconComponent = badgeInfo.icon;
  return (
    <IconComponent 
      size={size} 
      color={badgeInfo.color} 
      title={badgeInfo.name || badgeId} 
      className={`badge-icon ${className}`} 
    />
  );
};

export default BadgeIcon;
