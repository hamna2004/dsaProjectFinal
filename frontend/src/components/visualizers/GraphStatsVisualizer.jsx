import React, { useEffect, useState } from "react";
import { fetchGraphStats } from "../../services/api";

export default function GraphStatsVisualizer() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchGraphStats();
      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || "Failed to load stats");
      }
    } catch (err) {
      setError(err.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="visualizer-container">
        <div className="visualizer-loading">
          <div className="loading-spinner">⏳</div>
          <p>Loading graph statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="visualizer-container">
        <div className="visualizer-error">
          <div className="error-icon">❌</div>
          <p>{error}</p>
          <button onClick={loadStats} className="btn-retry">Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="visualizer-container">
        <div className="visualizer-placeholder">
          <div className="placeholder-icon">📈</div>
          <h4>No Data Available</h4>
        </div>
      </div>
    );
  }

  return (
    <div className="visualizer-container">
      <div className="graph-stats">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Vertices (Airports)</div>
            <div className="stat-value">{stats.vertices}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Edges (Flights)</div>
            <div className="stat-value">{stats.edges}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Graph Density</div>
            <div className="stat-value">{(stats.density * 100).toFixed(2)}%</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Avg Degree</div>
            <div className="stat-value">{stats.avg_degree}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Max Degree</div>
            <div className="stat-value">{stats.max_degree}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Min Degree</div>
            <div className="stat-value">{stats.min_degree}</div>
          </div>
        </div>
        <button onClick={loadStats} className="btn-refresh">🔄 Refresh</button>
      </div>
    </div>
  );
}

