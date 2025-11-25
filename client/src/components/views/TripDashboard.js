import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import '../../styles/TripDashboard.css';

const formatMetric = (value, suffix = '', digits = 1) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    return '—';
  }
  return `${number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: number < 10 ? Math.min(1, digits) : 0,
  })}${suffix}`;
};

const formatDuration = (value) => value || '—';

const formatDateRange = (trip) => {
  if (!trip) return null;
  const format = (input) => {
    if (!input) return null;
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const start = format(trip.start_date);
  const end = format(trip.end_date);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return null;
};

const ElevationTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="TripDashboard__tooltip">
      <strong>{formatMetric(point.distance_km, ' km', 2)}</strong>
      <span>Elevation: {formatMetric(point.elevation_m, ' m', 0)}</span>
      {point.time && <span>Time: {new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
    </div>
  );
};

const ActivityTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="TripDashboard__tooltip">
      <strong>{point.label}</strong>
      <span>{point.count} photos</span>
    </div>
  );
};

const TripDashboard = ({ data, loading, error, onRetry, trip }) => {
  if (loading) {
    return <div className="TripDashboard__state">Loading dashboard…</div>;
  }
  if (error) {
    return (
      <div className="TripDashboard__state TripDashboard__state--error">
        <p>{error}</p>
        <button type="button" onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="TripDashboard__state">
        Upload a GPX track to see trip analytics.
      </div>
    );
  }

  const stats = data.statistics || {};
  const restPoints = data.rest_points || [];
  const elevationProfile = Array.isArray(data.elevation_profile) ? data.elevation_profile : [];
  const activityCounts = data.activity_heatmap?.photo_counts_by_hour || [];
  const activityData = activityCounts.map((count, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, '0')}:00`,
    count,
  }));

  const kpis = [
    {
      id: 'distance',
      label: 'Distance',
      primary: formatMetric(stats.distance?.km, ' km', 2),
      secondary: stats.distance?.mi ? `${formatMetric(stats.distance.mi, ' mi', 2)}` : null,
      icon: '📏',
    },
    {
      id: 'elevation',
      label: 'Elevation Gain',
      primary: formatMetric(stats.elevation?.gain, ' m', 0),
      secondary: stats.elevation?.loss ? `Loss ${formatMetric(stats.elevation.loss, ' m', 0)}` : null,
      icon: '⛰️',
    },
    {
      id: 'duration',
      label: 'Moving Time',
      primary: formatDuration(stats.duration?.formatted),
      secondary: stats.duration?.rest_seconds
        ? `Rest ${formatMetric(stats.duration.rest_seconds / 60, ' min', 0)}`
        : null,
      icon: '⏱️',
    },
    {
      id: 'photos',
      label: 'Photos Logged',
      primary: `${stats.counts?.photos ?? 0}`,
      secondary: stats.counts?.geotagged_photos ? `${stats.counts.geotagged_photos} geotagged` : null,
      icon: '📸',
    },
    {
      id: 'speed',
      label: 'Avg Speed',
      primary: formatMetric(stats.speed?.average_kmh, ' km/h', 1),
      secondary: stats.speed?.max_kmh ? `Max ${formatMetric(stats.speed.max_kmh, ' km/h', 1)}` : null,
      icon: '🚶',
    },
    {
      id: 'altitude',
      label: 'Max Elevation',
      primary: formatMetric(stats.elevation?.max, ' m', 0),
      secondary: stats.elevation?.min ? `Min ${formatMetric(stats.elevation.min, ' m', 0)}` : null,
      icon: '🏔️',
    },
  ];

  const detailRows = [
    { label: 'Waypoints', value: stats.counts?.waypoints ?? 0 },
    { label: 'Rest stops', value: stats.counts?.rest_points ?? 0 },
    { label: 'Net elevation', value: formatMetric(stats.elevation?.net, ' m', 0) },
    { label: 'Moving avg speed', value: formatMetric(stats.speed?.moving_average_kmh, ' km/h', 1) },
    { label: 'Start time', value: stats.start_time ? new Date(stats.start_time).toLocaleString() : '—' },
    { label: 'End time', value: stats.end_time ? new Date(stats.end_time).toLocaleString() : '—' },
  ];

  return (
    <div className="TripDashboard">
      <header className="TripDashboard__intro">
        <div>
          <p className="eyebrow">Trip Dashboard</p>
          <h2>{trip?.name || 'Trip Overview'}</h2>
          <p className="muted">{formatDateRange(trip) || 'Dates not set'}</p>
        </div>
      </header>

      <section className="TripDashboard__kpiGrid">
        {kpis.map((kpi) => (
          <article key={kpi.id} className="TripDashboard__kpiCard">
            <div className="TripDashboard__kpiIcon" aria-hidden="true">{kpi.icon}</div>
            <div className="TripDashboard__kpiBody">
              <p>{kpi.label}</p>
              <strong>{kpi.primary}</strong>
              {kpi.secondary && <span>{kpi.secondary}</span>}
            </div>
          </article>
        ))}
      </section>

      <section className="TripDashboard__grid">
        <article className="TripDashboard__panel TripDashboard__panel--wide">
          <header>
            <h3>Elevation Profile</h3>
            <p className="muted">Hover to inspect grade, time, and elevation</p>
          </header>
          <div className="TripDashboard__chart">
            {elevationProfile.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={elevationProfile} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="distance_km"
                    tickFormatter={(value) =>
                      typeof value === 'number' ? `${value.toFixed(0)} km` : ''
                    }
                  />
                  <YAxis
                    dataKey="elevation_m"
                    tickFormatter={(value) =>
                      typeof value === 'number' ? `${value.toFixed(0)} m` : ''
                    }
                  />
                  <Tooltip content={<ElevationTooltip />} />
                  <Area type="monotone" dataKey="elevation_m" stroke="#2563eb" fillOpacity={1} fill="url(#elevationGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="TripDashboard__placeholder">Upload a GPX file to unlock the elevation profile.</div>
            )}
          </div>
        </article>

        <article className="TripDashboard__panel">
          <header>
            <h3>Activity by Hour</h3>
            <p className="muted">Photo counts grouped by capture hour</p>
          </header>
          <div className="TripDashboard__chart">
            {activityData.some((item) => item.count > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={activityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip content={<ActivityTooltip />} />
                  <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="TripDashboard__placeholder">No captured photos yet.</div>
            )}
          </div>
        </article>
      </section>

      <section className="TripDashboard__details">
        <article className="TripDashboard__panel TripDashboard__panel--details">
          <header>
            <h3>Detailed Statistics</h3>
          </header>
          <dl>
            {detailRows.map((row) => (
              <div key={row.label} className="TripDashboard__detailRow">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article className="TripDashboard__panel">
          <header>
            <h3>Rest Stops</h3>
            <p className="muted">Automatically detected pauses from the GPX analysis</p>
          </header>
          {restPoints.length ? (
            <ul className="TripDashboard__restList">
              {restPoints.map((rest, index) => (
                <li key={`${rest.start_time || index}`}>
                  <div>
                    <strong>{rest.start_time ? new Date(rest.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown time'}</strong>
                    <span>{rest.distance_from_start_km !== null && rest.distance_from_start_km !== undefined
                      ? `${formatMetric(rest.distance_from_start_km, ' km', 2)} from start`
                      : 'Distance unknown'}</span>
                  </div>
                  <div className="muted">
                    {formatMetric(rest.duration_minutes, ' min', 0)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="TripDashboard__placeholder">No rest points detected.</div>
          )}
        </article>
      </section>
    </div>
  );
};

export default TripDashboard;
