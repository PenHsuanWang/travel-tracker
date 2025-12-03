import React, { useMemo, useState, useEffect } from 'react';
import {
  addDays,
  endOfWeek,
  endOfYear,
  format,
  getYear,
  parseISO,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import '../../styles/ProfilePage.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ActivityHeatmap = ({ data = [] }) => {
  const normalizedData = useMemo(() => {
    const map = new Map();
    data.forEach((entry) => {
      if (!entry?.date) return;
      const parsed = parseISO(entry.date);
      if (Number.isNaN(parsed.getTime())) return;
      const key = format(parsed, 'yyyy-MM-dd');
      const current = map.get(key) || { value: 0, metadata: [] };
      map.set(key, {
        value: current.value + (entry.value || 0),
        metadata: entry.metadata ? current.metadata.concat(entry.metadata) : current.metadata,
      });
    });
    return map;
  }, [data]);

  const availableYears = useMemo(() => {
    const years = Array.from(normalizedData.keys()).map((key) => Number(key.slice(0, 4)));
    const unique = Array.from(new Set(years.length ? years : [new Date().getFullYear()]));
    unique.sort((a, b) => b - a);
    return unique;
  }, [normalizedData]);

  const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || new Date().getFullYear());

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] || new Date().getFullYear());
    }
  }, [availableYears, selectedYear]);

  const handleYearStep = (direction) => {
    if (!availableYears.length) return;
    const currentIndex = availableYears.indexOf(selectedYear);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const delta = direction === 'older' ? 1 : -1;
    const nextIndex = Math.min(
      availableYears.length - 1,
      Math.max(0, safeIndex + delta)
    );
    if (nextIndex !== safeIndex || currentIndex === -1) {
      setSelectedYear(availableYears[nextIndex]);
    }
  };

  const { weeks, monthMarkers, maxValue } = useMemo(() => {
    const year = selectedYear || new Date().getFullYear();
    const startDate = startOfWeek(startOfYear(new Date(year, 0, 1)), { weekStartsOn: 0 });
    const endDate = endOfWeek(endOfYear(new Date(year, 11, 31)), { weekStartsOn: 0 });

    const resultWeeks = [];
    const markers = [];
    let current = startDate;
    let idx = 0;

    while (current <= endDate) {
      const week = [];
      for (let i = 0; i < 7; i += 1) {
        week.push(current);
        current = addDays(current, 1);
      }
      const firstDay = week[0];
      if (firstDay.getDate() <= 7 && (idx === 0 || firstDay.getMonth() !== resultWeeks[idx - 1]?.[0]?.getMonth())) {
        markers.push({ label: format(firstDay, 'MMM'), index: idx });
      }
      resultWeeks.push(week);
      idx += 1;
    }

    let localMax = 0;
    normalizedData.forEach((entryValue, dateKey) => {
      if (getYear(parseISO(dateKey)) === year) {
        localMax = Math.max(localMax, entryValue.value || 0);
      }
    });

    return { weeks: resultWeeks, monthMarkers: markers, maxValue: localMax };
  }, [normalizedData, selectedYear]);

  const getIntensityLevel = (value) => {
    if (!value || maxValue === 0) return 0;
    const buckets = 4;
    const step = maxValue / buckets;
    for (let level = buckets; level >= 1; level -= 1) {
      if (value >= step * level * 0.85) {
        return level;
      }
    }
    return 1;
  };

  const buildTooltip = (dateObj, valueEntry) => {
    const dateLabel = format(dateObj, 'MMM d, yyyy');
    if (!valueEntry || !valueEntry.value) {
      return `${dateLabel}: No activity`;
    }
    const names = Array.from(
      new Set((valueEntry.metadata || []).map((meta) => meta?.tripName).filter(Boolean))
    );
    const tripsSuffix = names.length ? ` – ${names.join(', ')}` : '';
    return `${dateLabel}: ${valueEntry.value.toFixed(1)} km logged${tripsSuffix}`;
  };

  const currentYearIndex = availableYears.indexOf(selectedYear);
  const safeYearIndex = currentYearIndex === -1 ? 0 : currentYearIndex;
  const olderDisabled = availableYears.length <= 1 || safeYearIndex >= availableYears.length - 1;
  const newerDisabled = availableYears.length <= 1 || safeYearIndex <= 0;

  const yearOptions = availableYears.length > 1 ? (
    <select
      className="heatmap-year-select"
      value={selectedYear}
      onChange={(event) => setSelectedYear(Number(event.target.value))}
    >
      {availableYears.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  ) : (
    <span className="heatmap-year-label">{selectedYear}</span>
  );

  return (
    <div className="profile-section">
      <div className="heatmap-header">
        <h3>Yearly Activity</h3>
        <div className="heatmap-year-controls">
          <button
            type="button"
            className="heatmap-year-button"
            onClick={() => handleYearStep('older')}
            disabled={olderDisabled}
            aria-label="View earlier years"
          >
            ◀ Past
          </button>
          {yearOptions}
          <button
            type="button"
            className="heatmap-year-button"
            onClick={() => handleYearStep('newer')}
            disabled={newerDisabled}
            aria-label="View newer years"
          >
            Future ▶
          </button>
        </div>
      </div>
      <div className="activity-heatmap" role="img" aria-label="Yearly activity heatmap">
        <div className="heatmap-month-row">
          {monthMarkers.map((marker) => (
            <span
              key={`${marker.label}-${marker.index}`}
              className="heatmap-month-label"
              style={{ gridColumnStart: marker.index + 1 }}
            >
              {marker.label}
            </span>
          ))}
        </div>
        <div className="heatmap-grid">
          <div className="heatmap-day-labels">
            {DAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="heatmap-weeks">
            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="heatmap-week-column">
                {week.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const entry = normalizedData.get(dateKey);
                  const level = getIntensityLevel(entry?.value);
                  return (
                    <div
                      key={dateKey}
                      className={`heatmap-cell heatmap-level-${level}`}
                      title={buildTooltip(day, entry)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {maxValue === 0 && (
          <p className="no-data heatmap-empty">No activity data yet. Start logging trips to see your streaks.</p>
        )}
        <div className="heatmap-legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={`legend-${level}`} className={`heatmap-cell heatmap-level-${level}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
