import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAirports, findRoutes } from "../services/api";
import RouteMap from "../components/RouteMap";
import AirportDropdown from "../components/AirportDropDown.jsx";

import "../styles/route-planner.css";

export default function RoutePlanner() {
  const [airports, setAirports] = useState([]);
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [optimization, setOptimization] = useState("all");
  const [maxStops, setMaxStops] = useState(2);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [error, setError] = useState(null);

  // Load airports once
  useEffect(() => {
    fetchAirports().then(setAirports);
  }, []);

  const handleSearch = async () => {
    if (!source || !dest) return alert("Please select both airports.");

    console.log("SEARCH:", source, dest, optimization, maxStops);

    setLoading(true);
    setSelectedRoute(null);
    setResults(null);
    setError(null);

    try {
      const trimmedSource = source.trim();
      const trimmedDest = dest.trim();
      const opt = optimization.trim();

      const res = await findRoutes({
          source: trimmedSource,
          dest: trimmedDest,
          optimization: opt,
          max_stops: Number(maxStops),
      });

      console.log("API RESPONSE:", res);

      if (!res?.success) {
        setError(res?.error || "No route found");
        setResults(null);
        return;
      }

      setResults(res);
      setError(null);
    } catch (err) {
      console.error("API ERROR:", err);
      setError(err?.message || "Failed to fetch routes");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-page">
      {/* HERO */}
      <div className="card rp-hero">
        <div className="rp-hero-left">
          <h2>Plan Better. Fly Smarter.</h2>
          <p>Explore all flight route possibilities and find the best path instantly.</p>
        </div>
        <div className="hero-animations hero-animations--planner" aria-hidden="true">
          <span className="hero-plane hero-plane--one">✈</span>
          <span className="hero-plane hero-plane--two">✈</span>
          <span className="hero-plane hero-plane--three">✈</span>
          <span className="hero-plane hero-plane--four">✈</span>
          <span className="hero-plane hero-plane--five">✈</span>
          <span className="hero-plane hero-plane--six">✈</span>
          <span className="hero-plane hero-plane--seven">✈</span>
          <span className="hero-plane hero-plane--eight">✈</span>
          <span className="hero-plane hero-plane--nine">✈</span>
          <span className="hero-plane hero-plane--ten">✈</span>
          <span className="hero-plane hero-plane--eleven">✈</span>
          <span className="hero-plane hero-plane--twelve">✈</span>
          <span className="hero-plane hero-plane--thirteen">✈</span>
          <span className="hero-plane hero-plane--fourteen">✈</span>
          <span className="hero-plane hero-plane--fifteen">✈</span>
          <span className="hero-plane hero-plane--sixteen">✈</span>
          <span className="hero-plane hero-plane--seventeen">✈</span>
          <span className="hero-dot hero-dot--one"></span>
          <span className="hero-dot hero-dot--two"></span>
        </div>
      </div>

      <div className="rp-container">
        {/* LEFT PANEL */}
        <div className="rp-left">
          <div className="card rp-search-card">
            <div className="rp-search-header">
              <span className="rp-search-icon" aria-hidden="true">✈</span>
              <div>
                <p className="rp-search-eyebrow">Plan your route</p>
                <h3>Route Search</h3>
                <p className="rp-search-subtitle">
                  Select departure, destination & optimization mode
                </p>
              </div>
            </div>

            {/* Airport Dropdowns */}
            <div className="rp-row">
              <AirportDropdown
                label="From"
                airports={airports}
                value={source}
                onChange={setSource}
              />

              <AirportDropdown
                label="To"
                airports={airports}
                value={dest}
                onChange={setDest}
              />
            </div>

            {/* Optimization Buttons */}
            <div className="rp-row rp-toggle">
              {["all", "cheapest", "fastest", "shortest"].map((mode) => (
                <button
                  key={mode}
                  className={optimization === mode ? "active" : ""}
                  onClick={() => setOptimization(mode)}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
            
            {/* Best Overall Button - Separate Row */}
            <div className="rp-row rp-toggle">
              <button
                className={optimization === "best_overall" ? "active" : ""}
                onClick={() => setOptimization("best_overall")}
                style={{ width: "100%" }}
              >
                BEST OVERALL
              </button>
            </div>

            {/* Max Stops + Search Button */}
            <div className="rp-row rp-actions">
              <div className="rp-field small">
                <label>Max Stops</label>
                <select
                  value={maxStops}
                  onChange={(e) => setMaxStops(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn btn--primary rp-find-button" onClick={handleSearch}>
                {loading ? "Searching..." : "Find Routes"}
              </button>
            </div>
          </div>
        </div>

        {/* MAIN RESULTS AREA */}
        <div className="rp-main">
          {/* ROUTE SUMMARY BAR + AVAILABLE ROUTES */}
          {results?.success && results.routes && results.routes.length > 0 && (
            <RouteSummary
              routes={results.routes}
              onSelectRoute={(route) => setSelectedRoute(route)}
            />
          )}

          {results?.success && results.routes && results.routes.length === 0 && (
            <div className="card">
              <h3>No Routes Found</h3>
              <p>Try increasing the maximum stops or choosing different airports.</p>
            </div>
          )}

          {error && (
            <div className="card" style={{ borderColor: "#ef4444", color: "#b91c1c" }}>
              <h3>Unable to fetch routes</h3>
              <p>{error}</p>
            </div>
          )}

          {/* SINGLE BEST ROUTE */}
          {results?.success && results.route && (
            <div className="card route-detail">
              <h3>Best Route</h3>
              <p>{results.route.path.join(" → ")}</p>
              <button
                className="btn"
                onClick={() => setSelectedRoute(results.route)}
              >
                View on Map
              </button>
            </div>
          )}

          {/* ROUTE DETAIL VIEW */}
          {selectedRoute && (
            <div className="card route-detail">
              <h3>Route Details</h3>
              <p>{selectedRoute.path.join(" → ")}</p>

              <div className="route-info">
                <p>
                  <b>Total Distance:</b> {selectedRoute.totalDistanceKM} km
                </p>
                <p>
                  <b>Total Duration:</b> {selectedRoute.totalDurationMin} min
                </p>
                <p>
                  <b>Total Price:</b> ${selectedRoute.totalPriceUSD}
                </p>
              </div>

              <RouteMap
                coords={selectedRoute.coords}
                airports={selectedRoute.path}
              />
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

// Move pickBest outside the component
const pickBest = (routes, key) => {
  return routes.reduce((best, route) => {
    const value = route[key];
    if (value === undefined || value === null) return best;
    if (!best || value < best[key]) {
      return route;
    }
    return best;
  }, null);
};

function RouteSummary({ routes, onSelectRoute }) {
  const summary = useMemo(() => {
    if (!routes?.length) return null;
    return {
      price: pickBest(routes, "totalPriceUSD"),
      fastest: pickBest(routes, "totalDurationMin"),
      shortest: pickBest(routes, "totalDistanceKM"),
    };
  }, [routes]);

  const formatCurrency = (val) =>
    val || val === 0 ? `$${Number(val).toFixed(0)}` : "—";
  const formatDuration = (minutes) => {
    if (!Number.isFinite(minutes)) return "—";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins ? `${mins}m` : ""}`.trim();
  };
  const formatDistance = (km) =>
    Number.isFinite(km) ? `${Math.round(km)} km` : "—";

  const summaryCards = [
    {
      key: "price",
      label: "Best Price",
      icon: "⭐",
      value: formatCurrency(summary?.price?.totalPriceUSD),
      detail: summary?.price?.path?.join(" → ") || "N/A",
    },
    {
      key: "fastest",
      label: "Fastest",
      icon: "⚡",
      value: formatDuration(summary?.fastest?.totalDurationMin),
      detail: summary?.fastest?.path?.join(" → ") || "N/A",
    },
    {
      key: "shortest",
      label: "Shortest",
      icon: "✈️",
      value: formatDistance(summary?.shortest?.totalDistanceKM),
      detail: summary?.shortest?.path?.join(" → ") || "N/A",
    },
  ];

  return (
    <>
      {summary && (
        <div className="rp-summary">
          {summaryCards.map((card) => (
            <div key={card.key} className="rp-summary-card">
              <p className="rp-summary-label">
                <span className={`rp-summary-icon rp-summary-icon--${card.key}`}>
                  {card.icon}
                </span>
                {card.label}
              </p>
              <div className="rp-summary-value">{card.value}</div>
              <p className="rp-summary-detail">{card.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card routes-card">
        <h3>Available Routes</h3>
        <div className="routes-scroll">
          {routes.map((rt, i) => (
            <div
              key={`${rt.path?.join("-")}-${i}`}
              className="route-card"
              onClick={() => onSelectRoute && onSelectRoute(rt)}
            >
              <h4>{rt.path.join(" → ")}</h4>
              <RouteMiniMap path={rt.path} />
              <p>{rt.stops} stops</p>
              <p>
                <b>{rt.totalDurationMin}</b> min — <b>${rt.totalPriceUSD}</b>
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function RouteMiniMap({ path = [] }) {
  if (!path || path.length < 2) return null;
  const width = 200;
  const height = 36;
  const step = width / (path.length - 1);
  const stopsCount = Math.max(path.length - 2, 0);

  return (
    <div className="route-mini">
      <svg
        width="100%"
        height="36"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <line
          x1="5"
          y1={height / 2}
          x2={width - 5}
          y2={height / 2}
          className="route-mini-line"
        />
        {path.map((code, idx) => (
          <g
            key={`${code}-${idx}`}
            transform={`translate(${idx * step + 5}, ${height / 2})`}
          >
            <circle
              r={idx === 0 || idx === path.length - 1 ? 5 : 4}
              className={`route-mini-node ${
                idx === 0
                  ? "start"
                  : idx === path.length - 1
                  ? "end"
                  : "stop"
              }`}
            />
          </g>
        ))}
      </svg>
      <div className="route-mini-label">
        <span>{path[0]}</span>
        <span className="route-mini-arrow">→</span>
        <span>{path[path.length - 1]}</span>
        <span className="route-mini-stops">
          {stopsCount === 0
            ? "Direct"
            : `${stopsCount} stop${stopsCount > 1 ? "s" : ""}`}
        </span>
      </div>
      {stopsCount > 0 && (
        <div className="route-mini-stops-detail">
          via {path.slice(1, -1).join(", ")}
        </div>
      )}
    </div>
  );
}
