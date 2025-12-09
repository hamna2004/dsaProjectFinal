import React, { useEffect, useState } from "react";
import { fetchRouteGraphAnalysis } from "../services/api";
import "../styles/route-graph-analysis.css";

export default function RouteGraphAnalysis({ source, dest }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (source && dest) {
      loadAnalysis();
    } else {
      setAnalysis(null);
    }
  }, [source, dest]);

  const loadAnalysis = async () => {
    if (!source || !dest) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRouteGraphAnalysis(source, dest);
      if (result.success) {
        setAnalysis(result.data);
      } else {
        setError(result.error || "Failed to load analysis");
      }
    } catch (err) {
      setError(err.message || "Failed to load analysis");
    } finally {
      setLoading(false);
    }
  };

  if (!source || !dest) {
    return (
      <div className="route-graph-analysis">
        <div className="rga-placeholder">
          <p>Select source and destination to see route graph analysis</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="route-graph-analysis">
        <div className="rga-loading">Loading route analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="route-graph-analysis">
        <div className="rga-error">
          <p>{error}</p>
          <button onClick={loadAnalysis} className="btn-retry">Retry</button>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const { subgraph, path_stats, network_context } = analysis;

  return (
    <div className="route-graph-analysis">
      <div className="rga-header">
        <h4>📊 Route Graph Analysis</h4>
        <p className="rga-route">{source} → {dest}</p>
      </div>

      <div className="rga-content">
        {/* Subgraph Stats */}
        <div className="rga-section">
          <h5>Subgraph Overview</h5>
          <div className="rga-stats-grid">
            <div className="rga-stat">
              <span className="rga-stat-label">Airports in Route Network</span>
              <span className="rga-stat-value">{subgraph.vertices_count}</span>
            </div>
            <div className="rga-stat">
              <span className="rga-stat-label">Available Flights</span>
              <span className="rga-stat-value">{subgraph.edges_count}</span>
            </div>
            <div className="rga-stat">
              <span className="rga-stat-label">Network Density</span>
              <span className="rga-stat-value">{(network_context.subgraph_density * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Path Statistics */}
        <div className="rga-section">
          <h5>Path Options</h5>
          <div className="rga-paths">
            <div className="rga-path-item">
              <span className="rga-path-type">Direct</span>
              <span className="rga-path-count">{path_stats.direct_flights} route(s)</span>
            </div>
            <div className="rga-path-item">
              <span className="rga-path-type">1 Stop</span>
              <span className="rga-path-count">{path_stats.one_stop_options} route(s)</span>
            </div>
            <div className="rga-path-item">
              <span className="rga-path-type">2 Stops</span>
              <span className="rga-path-count">{path_stats.two_stop_options} route(s)</span>
            </div>
            <div className="rga-path-item rga-path-total">
              <span className="rga-path-type">Total Options</span>
              <span className="rga-path-count">{path_stats.total_paths} route(s)</span>
            </div>
          </div>
        </div>

        {/* Network Context */}
        <div className="rga-section">
          <h5>Network Context</h5>
          <div className="rga-context">
            <div className="rga-context-item">
              <span>Source ({source}) Connections:</span>
              <strong>{network_context.source_degree}</strong>
            </div>
            <div className="rga-context-item">
              <span>Destination ({dest}) Incoming:</span>
              <strong>{network_context.dest_degree}</strong>
            </div>
            <div className="rga-context-item">
              <span>Connectivity:</span>
              <strong className={network_context.is_connected ? "rga-connected" : "rga-disconnected"}>
                {network_context.is_connected ? "✅ Connected" : "❌ Not Connected"}
              </strong>
            </div>
          </div>
        </div>

        {/* Airports in Subgraph */}
        <div className="rga-section">
          <h5>Airports in Route Network</h5>
          <div className="rga-airports">
            {subgraph.airports.map((airport, idx) => (
              <span
                key={airport}
                className={`rga-airport ${airport === source ? "rga-source" : ""} ${airport === dest ? "rga-dest" : ""}`}
              >
                {airport}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

