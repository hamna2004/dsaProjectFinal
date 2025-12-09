import RouteMap from './RouteMap';
import './RouteDisplay.css';

const RouteDisplay = ({ route }) => {
  if (!route || !route.success) {
    return null;
  }

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDistance = (km) => {
    return `${km.toLocaleString()} km`;
  };

  return (
    <div className="route-display">
      <div className="route-header">
        <h2>Optimal Route Found</h2>
        <div className="route-summary">
          <div className="summary-item">
            <span className="summary-label">Route:</span>
            <span className="summary-value">{route.path.join(' → ')}</span>
          </div>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-label">Distance</span>
              <span className="stat-value">{formatDistance(route.total_distance)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Cost</span>
              <span className="stat-value">${route.total_price.toFixed(2)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Duration</span>
              <span className="stat-value">{formatDuration(route.total_duration)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Stops</span>
              <span className="stat-value">{route.stops}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="route-content">
        <div className="route-flights">
          <h3>Flight Details</h3>
          {route.flights.map((flight, index) => (
            <div key={flight.id} className="route-flight-card">
              <div className="flight-segment-header">
                <span className="segment-number">Segment {index + 1}</span>
                <span className="segment-route">
                  {flight.source_code} → {flight.dest_code}
                </span>
              </div>
              <div className="flight-segment-details">
                <div className="segment-info">
                  <div className="info-row">
                    <span className="info-label">Airline:</span>
                    <span className="info-value">{flight.airline} {flight.flight_no}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Departure:</span>
                    <span className="info-value">{flight.departure_time || 'N/A'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Arrival:</span>
                    <span className="info-value">{flight.arrival_time || 'N/A'}</span>
                  </div>
                </div>
                <div className="segment-stats">
                  <div className="mini-stat">
                    <span className="mini-stat-label">Duration</span>
                    <span className="mini-stat-value">{flight.duration} min</span>
                  </div>
                  <div className="mini-stat">
                    <span className="mini-stat-label">Price</span>
                    <span className="mini-stat-value">${flight.price.toFixed(2)}</span>
                  </div>
                  <div className="mini-stat">
                    <span className="mini-stat-label">Distance</span>
                    <span className="mini-stat-value">{formatDistance(flight.distance)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="route-map-container">
          <h3>Route Map</h3>
          <RouteMap route={route} />
        </div>
      </div>

      <div className="route-actions">
        <button className="btn btn--primary btn--large">Book This Route</button>
      </div>
    </div>
  );
};

export default RouteDisplay;

