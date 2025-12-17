import './FlightResults.css';



const FlightResults = ({ flights, source, dest }) => {
  if (flights.length === 0) {
    return (
      <div className="flight-results">
        <div className="no-results">
          <p>No flights found. Try a different search.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flight-results">
      <div className="results-header">
        <h2>
          {source && dest
            ? `Flights from ${source} to ${dest}`
            : 'All Available Flights'}
        </h2>
        <p className="results-count">{flights.length} flight(s) found</p>
      </div>

      <div className="flights-list">
        {flights.map((flight) => (
          <div key={flight.id} className="flight-card">
            <div className="flight-card__header">
              <div className="flight-airline">
                <span className="airline-name">{flight.airline}</span>
                <span className="flight-number">{flight.flight_no}</span>
              </div>
              <div className="flight-price">
                ${flight.price?.toFixed(2) || 'N/A'}
              </div>
            </div>

            <div className="flight-card__route">
              <div className="route-segment">
                <div className="route-time">{flight.departure_time || 'N/A'}</div>
                <div className="route-airport">
                  <span className="airport-code">
                    {flight.source_airport?.code || 'N/A'}
                  </span>
                  <span className="airport-city">
                    {flight.source_airport?.city || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="route-connector">
                <div className="connector-line"></div>
                <div className="connector-duration">
                  {flight.duration ? `${flight.duration} min` : 'N/A'}
                </div>
                <div className="connector-line"></div>
              </div>

              <div className="route-segment">
                <div className="route-time">{flight.arrival_time || 'N/A'}</div>
                <div className="route-airport">
                  <span className="airport-code">
                    {flight.dest_airport?.code || 'N/A'}
                  </span>
                  <span className="airport-city">
                    {flight.dest_airport?.city || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flight-card__footer">
              <button className="btn btn--book">Book Now</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlightResults;

