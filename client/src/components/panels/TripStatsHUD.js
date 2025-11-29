import React, { useState, useMemo, useRef } from 'react';
import { ChevronUp, ChevronDown, Activity, Clock, ArrowUp, Mountain } from 'lucide-react';
import '../../styles/TripStatsHUD.css';

const TripStatsHUD = ({ trackSummary }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [hoverData, setHoverData] = useState(null);
    const svgRef = useRef(null);

    const stats = useMemo(() => {
        if (!trackSummary) return null;

        const distanceKm = (trackSummary.total_distance_m / 1000).toFixed(1);
        
        const hours = Math.floor(trackSummary.duration_seconds / 3600);
        const minutes = Math.floor((trackSummary.duration_seconds % 3600) / 60);
        const timeStr = `${hours}h ${minutes}m`;

        const gain = Math.round(trackSummary.elevation_gain_m);
        const maxElev = Math.round(trackSummary.max_elevation_m);

        return { distanceKm, timeStr, gain, maxElev };
    }, [trackSummary]);

    const chartData = useMemo(() => {
        if (!trackSummary?.elevation_profile || trackSummary.elevation_profile.length < 2) return null;

        const points = trackSummary.elevation_profile;
        const width = 1000; // SVG internal coordinate system width
        const height = 200; // SVG internal coordinate system height
        
        const maxDist = points[points.length - 1][0];
        const elevations = points.map(p => p[1]);
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        // Add some padding to min/max elev for visual comfort
        const elevRange = (maxElev - minElev) * 1.1 || 10; 
        const baseElev = minElev - (elevRange * 0.05);

        const coords = points.map(([d, e]) => {
            const x = (d / maxDist) * width;
            const y = height - ((e - baseElev) / elevRange) * height;
            return { x, y, d, e };
        });

        // Line path (stroke)
        const linePathCmd = `M ${coords.map(p => `${p.x},${p.y}`).join(' L ')}`;

        // Area path (fill)
        const areaPathCmd = `${linePathCmd} L ${width},${height} L 0,${height} Z`;

        return { linePathCmd, areaPathCmd, minElev, maxElev, maxDist, coords, width, height };
    }, [trackSummary]);

    const xAxisTicks = useMemo(() => {
        if (!chartData) return [];
        const maxDistKm = chartData.maxDist / 1000;
        // Aim for ~6-8 ticks
        const targetTicks = 6;
        const roughStep = maxDistKm / targetTicks;
        
        // Find nice step size
        const step = [1, 2, 5, 10, 20, 50, 100].find(m => m >= roughStep) || roughStep;
        
        const ticks = [];
        // Start from 0 or step, depending on preference. Screenshot showed 1km, 5km... 
        // but 0-based is standard. Let's do 0-based multiples of step.
        for (let i = 0; i <= maxDistKm; i += step) {
            ticks.push(i);
        }
        return ticks;
    }, [chartData]);

    const handleMouseMove = (e) => {
        if (!chartData || !svgRef.current) return;
        
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        // Convert screen X to SVG X
        const svgX = (x / rect.width) * chartData.width;

        // Find closest point
        // Since coords are sorted by x, we can use binary search or just find (array is small enough ~200 points)
        let closest = chartData.coords[0];
        let minDiff = Math.abs(svgX - closest.x);

        for (let i = 1; i < chartData.coords.length; i++) {
            const diff = Math.abs(svgX - chartData.coords[i].x);
            if (diff < minDiff) {
                minDiff = diff;
                closest = chartData.coords[i];
            }
        }

        setHoverData({
            x: (closest.x / chartData.width) * rect.width, // Screen pixel X relative to SVG container
            y: (closest.y / chartData.height) * rect.height, // Screen pixel Y relative to SVG container
            svgX: closest.x,
            svgY: closest.y,
            distance: closest.d,
            elevation: closest.e
        });
    };

    const handleMouseLeave = () => {
        setHoverData(null);
    };

    if (!stats) return null;

    return (
        <div className={`trip-stats-hud ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="trip-stats-header" onClick={() => setIsCollapsed(!isCollapsed)}>
                <span className="trip-stats-title">Trip Stats</span>
                <button className="trip-stats-toggle">
                    {isCollapsed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
            </div>

            {!isCollapsed && (
                <div className="trip-stats-content">
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-label"><Activity size={14} /> Distance</div>
                            <div className="stat-value">{stats.distanceKm}<span className="stat-unit">km</span></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label"><Clock size={14} /> Time</div>
                            <div className="stat-value">{stats.timeStr}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label"><ArrowUp size={14} /> Gain</div>
                            <div className="stat-value">{stats.gain}<span className="stat-unit">m</span></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label"><Mountain size={14} /> Max Elev</div>
                            <div className="stat-value">{stats.maxElev}<span className="stat-unit">m</span></div>
                        </div>
                    </div>

                    {chartData && (
                        <div className="elevation-profile-container">
                            <div className="elevation-profile-label">Elevation Profile</div>
                            <div 
                                className="elevation-chart" 
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                                ref={svgRef}
                            >
                                <svg viewBox="0 0 1000 200" className="chart-svg" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                                        </linearGradient>
                                    </defs>
                                    <path d={chartData.areaPathCmd} fill="url(#chartGradient)" />
                                    <path d={chartData.linePathCmd} fill="none" stroke="#10b981" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                                    
                                    {hoverData && (
                                        <>
                                            <line 
                                                x1={hoverData.svgX} 
                                                y1={0} 
                                                x2={hoverData.svgX} 
                                                y2={200} 
                                                className="chart-hover-line"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                            <circle 
                                                cx={hoverData.svgX} 
                                                cy={hoverData.svgY} 
                                                className="chart-hover-dot"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        </>
                                    )}
                                </svg>
                                
                                {hoverData && (
                                    <div 
                                        className="chart-tooltip"
                                        style={{ 
                                            left: hoverData.x, 
                                            top: hoverData.y 
                                        }}
                                    >
                                        <div className="chart-tooltip-row">
                                            <span className="chart-tooltip-label">km</span>
                                            <span className="chart-tooltip-value">{(hoverData.distance / 1000).toFixed(2)}</span>
                                        </div>
                                        <div className="chart-tooltip-row">
                                            <span className="chart-tooltip-value elevation">Elevation : {Math.round(hoverData.elevation)}m</span>
                                        </div>
                                    </div>
                                )}

                                <div className="chart-x-axis">
                                    {xAxisTicks.map(tick => (
                                        <span 
                                            key={tick} 
                                            className="chart-x-label"
                                            style={{ left: `${(tick / (chartData.maxDist/1000)) * 100}%` }}
                                        >
                                            {tick}km
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TripStatsHUD;
