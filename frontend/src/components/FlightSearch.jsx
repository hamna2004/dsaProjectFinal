

import React, { useState, useEffect } from "react";
import AirportDropdown from "./AirportDropDown"; // ← NEW IMPORT
import { fetchAirports, fetchFlights, findOptimalRoute } from "../services/api";
import "./FlightSearch.css";

const FlightSearch = () => {
  const [airports, setAirports] = useState([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [searchMode, setSearchMode] = useState("direct");
  const [optimization] = useState("distance");

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Load airports once
  useEffect(() => {
    fetchAirports().then(setAirports);
  }, []);

  // 🔍 SEARCH LOGIC
  const onSearchFlights = async () => {
    if (!from || !to) {
      setError("Please select both airports.");
      return;
    }

    setError(null);
    setLoading(true);
    setResults(null);

    try {
      if (searchMode === "direct") {
        const flights = await fetchFlights(from, to);
        // Ensure flights is an array
        const flightsArray = Array.isArray(flights) ? flights : [];
        setResults({ type: "direct", flights: flightsArray });
      } else {
        // Use Pareto optimal algorithm for optimal route
        const result = await findOptimalRoute(from, to, "pareto");
        if (result.success) {
          setResults({ 
            type: "optimal", 
            routes: result.routes || [],
            paretoCount: result.pareto_count || 0,
            totalCandidates: result.total_candidates || 0
          });
        } else {
          setError(result.error || "No optimal routes found");
        }
      }
    } catch (err) {
      console.error("❌ Search error:", err);
      setError(err.message || "Search failed");
    }

    setLoading(false);
  };

  return (
    <section className="flight-search">
      <div className="search-form">

        {/* Airport Dropdowns */}
        <div className="search-row">
          <AirportDropdown
            label="From"
            airports={airports}
            value={from}
            onChange={setFrom}
          />

          <AirportDropdown
            label="To"
            airports={airports}
            value={to}
            onChange={setTo}
          />
        </div>

        {/* Search Mode Toggle */}
        <div className="search-field search-field--full">
          <label>Search Mode</label>
          <div className="search-mode-toggle">
            <button
              className={`mode-btn ${searchMode === "direct" ? "active" : ""}`}
              onClick={() => setSearchMode("direct")}
            >
              Direct Flights Only
            </button>

            <button
              className={`mode-btn ${searchMode === "optimal" ? "active" : ""}`}
              onClick={() => setSearchMode("optimal")}
            >
              Find Optimal Route
            </button>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="search-form__actions">
          <button
            className="btn btn--primary"
            disabled={!from || !to || loading}
            onClick={onSearchFlights}
          >
            {loading ? "Searching..." : "Search Flights"}
          </button>

          <button className="btn btn--secondary">View All Flights</button>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      {/* RESULTS SECTION */}
      {results && (
        <div className="results-box">
          <h2 className="results-title">
            {results.type === "direct" ? "Direct Flights" : "Optimal Route"}
          </h2>

          {/* DIRECT FLIGHTS */}
          {results.type === "direct" && (
            <table className="results-table">
              <thead>
                <tr>
                  <th>Flight No</th>
                  <th>Airline</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Duration</th>
                  <th>Price</th>
                </tr>
              </thead>

              <tbody>
                {results.flights && results.flights.length > 0 ? (
                  results.flights.map((f) => (
                    <tr key={f.id}>
                      <td>{f.flight_no || "N/A"}</td>
                      <td>{f.airline || "N/A"}</td>
                      <td>{f.source_airport?.code || f.source_code || "N/A"}</td>
                      <td>{f.dest_airport?.code || f.dest_code || "N/A"}</td>
                      <td>
                        {f.duration 
                          ? typeof f.duration === 'number' 
                            ? `${f.duration} min` 
                            : String(f.duration)
                          : "n/a"}
                      </td>
                      <td>
                        {f.price 
                          ? typeof f.price === 'number' 
                            ? `$${f.price.toFixed(2)}` 
                            : `$${f.price}`
                          : "n/a"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">No direct flights found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* PARETO OPTIMAL ROUTES */}
          {results.type === "optimal" && results.routes && results.routes.length > 0 && (
            <div className="optimal-route-box">
              <div className="pareto-header">
                <h3>Pareto Optimal Routes</h3>
                <div className="pareto-stats">
                  <span>Found {results.paretoCount} optimal route{results.paretoCount !== 1 ? 's' : ''}</span>
                  {results.totalCandidates > 0 && (
                    <span className="pareto-candidates">
                      (from {results.totalCandidates} candidate{results.totalCandidates !== 1 ? 's' : ''})
                    </span>
                  )}
                </div>
              </div>
              
              <div className="pareto-explanation">
                <p>
                  <strong>Pareto Optimal:</strong> These routes are optimal because no other route is better 
                  in ALL criteria (price, time, distance) simultaneously. Choose based on your preference.
                </p>
              </div>

              <div className="pareto-routes-list">
                {results.routes.map((route, routeIndex) => (
                  <div key={routeIndex} className="pareto-route-card">
                    <div className="pareto-route-header">
                      <h4>Route {routeIndex + 1}</h4>
                      <div className="pareto-route-metrics">
                        <span className="metric-item">
                          <strong>Price:</strong> ${(route.totalPriceUSD || route.total_cost || 0).toFixed(2)}
                        </span>
                        <span className="metric-item">
                          <strong>Time:</strong> {route.totalDurationMin 
                            ? `${(route.totalDurationMin / 60).toFixed(1)} hrs` 
                            : route.total_duration
                            ? `${(route.total_duration / 60).toFixed(1)} hrs`
                            : "N/A"}
                        </span>
                        <span className="metric-item">
                          <strong>Distance:</strong> {(route.totalDistanceKM || route.total_distance || 0).toFixed(0)} km
                        </span>
                      </div>
                    </div>

                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Leg</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Distance</th>
                          <th>Cost</th>
                          <th>Duration</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(route.legs || []).map((leg, legIndex) => {
                          // Calculate distance for this leg if not present
                          const legDistance = leg.distance || 0;
                          const legCost = leg.priceUSD || leg.cost || leg.price || 0;
                          const legDuration = leg.durationMin || leg.duration || 0;
                          
                          return (
                            <tr key={legIndex}>
                              <td>{legIndex + 1}</td>
                              <td>{leg.from || leg.source_airport?.code || "N/A"}</td>
                              <td>{leg.to || leg.dest_airport?.code || "N/A"}</td>
                              <td>{legDistance > 0 ? `${legDistance.toFixed(0)} km` : "N/A"}</td>
                              <td>${legCost > 0 ? legCost.toFixed(2) : "N/A"}</td>
                              <td>
                                {legDuration > 0 
                                  ? `${(legDuration / 60).toFixed(1)} hrs`
                                  : "N/A"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.type === "optimal" && (!results.routes || results.routes.length === 0) && (
            <div className="optimal-route-box">
              <p>No optimal routes found.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default FlightSearch;
