import L from 'leaflet';

// Semantic icon configuration matching PRD FR-A01
export const ICON_CONFIG = {
  water: { emoji: '💧', color: 'bg-blue-500', label: 'Water' },
  camp: { emoji: '⛺', color: 'bg-orange-500', label: 'Camp' },
  signal: { emoji: '📶', color: 'bg-green-500', label: 'Signal' },
  hazard: { emoji: '⚠️', color: 'bg-red-500', label: 'Hazard' },
  checkin: { emoji: '🆘', color: 'bg-red-600', label: 'Check-in' },
  generic: { emoji: '📍', color: 'bg-gray-500', label: 'Point' },
};

export const getSemanticIcon = (type, options = {}) => {
  const config = ICON_CONFIG[type] || ICON_CONFIG.generic;
  const { size = 32, selected = false, highlighted = false } = options;

  // Use inline styles for dynamic dimensions to ensure reliability
  // (Tailwind arbitrary values like w-[${size}px] rely on static analysis)
  const containerStyle = `width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;`;
  
  // Base classes
  const baseClasses = `relative rounded-full border-2 border-white shadow-md`;
  const colorClass = config.color;
  const selectedClass = selected ? 'ring-2 ring-offset-1 ring-red-500' : '';
  const highlightClass = highlighted ? 'scale-110' : '';

  const html = `
    <div class="${baseClasses} ${colorClass} ${selectedClass} ${highlightClass}" style="${containerStyle}">
      <span style="font-size:${Math.round(size * 0.6)}px; line-height: 1;">${config.emoji}</span>
    </div>
  `;

  return L.divIcon({
    className: 'custom-div-icon', // Use a generic class to avoid default leaflet styling interference if needed
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2], // Center anchor for circular icons
    popupAnchor: [0, -size / 2],
  });
};

export default getSemanticIcon;