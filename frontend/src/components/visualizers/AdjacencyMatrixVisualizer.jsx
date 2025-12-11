import React, { useEffect, useState, useMemo } from "react";
import { fetchAdjacencyMatrix } from "../../services/api";

/**
 * Adjacency Matrix Visualizer Component
 * 
 * DSA CONCEPT: Adjacency Matrix Representation
 * 
 * An adjacency matrix is a 2D array where:
 * - Rows and columns represent vertices (airports)
 * - matrix[i][j] = 1 if there's an edge from airport i to airport j, else 0
 * 
 * Why use adjacency matrices?
 * - Space complexity: O(V²) - always stores V×V entries
 * - Fast edge lookup: O(1) to check if edge exists
 * - Good for dense graphs (many edges relative to possible edges)
 * 
 * In route planning:
 * - Less efficient than adjacency lists for sparse flight networks
 * - Useful for algorithms that need constant-time edge queries
 * - Trade-off: more memory for faster lookups
 */
export default function AdjacencyMatrixVisualizer() {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [showSubset, setShowSubset] = useState(false);
  const [maxDisplaySize, setMaxDisplaySize] = useState(20);

  // Fetch adjacency matrix data on component mount
  useEffect(() => {
    loadMatrix();
  }, []);

  const loadMatrix = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdjacencyMatrix();
      if (result.success) {
        setMatrixData(result.data);
      } else {
        setError(result.error || "Failed to load adjacency matrix");
      }
    } catch (err) {
      setError(err.message || "Failed to load adjacency matrix");
    } finally {
      setLoading(false);
    }
  };

  // Always show all airports for the matrix
  const filteredAirports = useMemo(() => {
    if (!matrixData) {
      return [];
    }
    return matrixData.airports || [];
  }, [matrixData]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!matrixData) return null;

    const airports = matrixData.airports || [];
    const matrix = matrixData.matrix || [];
    const n = airports.length;

    let totalConnections = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (matrix[i] && matrix[i][j] > 0) {
          totalConnections++;
        }
      }
    }

    const possibleConnections = n * n; // Including self-loops (though we don't have them)
    const density = n > 0 ? ((totalConnections / possibleConnections) * 100).toFixed(2) : 0;

    return {
      totalAirports: n,
      totalConnections,
      density: parseFloat(density),
    };
  }, [matrixData]);

  // Get display airports (either filtered or subset)
  const displayAirports = useMemo(() => {
    if (showSubset && matrixData) {
      return (matrixData.airports || []).slice(0, maxDisplaySize);
    }
    return filteredAirports.length > 0 ? filteredAirports : (matrixData?.airports || []);
  }, [filteredAirports, showSubset, maxDisplaySize, matrixData]);

  // Get indices for display airports
  const displayIndices = useMemo(() => {
    if (!matrixData) return [];
    return displayAirports.map((code) => matrixData.airports.indexOf(code));
  }, [displayAirports, matrixData]);

  if (loading) {
    return (
      <div className="adj-matrix-container">
        <div className="adj-matrix-loading">
          <div className="loading-spinner"></div>
          <p>Loading adjacency matrix...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="adj-matrix-container">
        <div className="adj-matrix-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={loadMatrix} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!matrixData || !matrixData.airports || matrixData.airports.length === 0) {
    return (
      <div className="adj-matrix-container">
        <div className="adj-matrix-empty">
          <div className="empty-icon">📊</div>
          <p>No adjacency matrix data available</p>
        </div>
      </div>
    );
  }

  const matrix = matrixData.matrix || [];
  const allAirports = matrixData.airports || [];
  const shouldShowSubsetToggle = allAirports.length > maxDisplaySize;

  return (
    <div className="adj-matrix-container">
      {/* Header with Statistics */}
      <div className="adj-matrix-header">
        <div className="adj-matrix-stats">
          <div className="stat-item">
            <span className="stat-label">Airports:</span>
            <span className="stat-value">{stats?.totalAirports || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Connections:</span>
            <span className="stat-value">{stats?.totalConnections || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Density:</span>
            <span className="stat-value">{stats?.density || 0}%</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      {shouldShowSubsetToggle && (
        <div className="adj-matrix-controls">
          <div className="control-group">
            <label className="subset-toggle">
              <input
                type="checkbox"
                checked={showSubset}
                onChange={(e) => setShowSubset(e.target.checked)}
              />
              <span>Show first {maxDisplaySize} airports</span>
            </label>
          </div>
        </div>
      )}

      {/* Matrix Grid */}
      <div className="adj-matrix-wrapper">
        <div 
          className="adj-matrix-grid"
          style={{ 
            gridTemplateColumns: `80px repeat(${displayAirports.length}, 40px)`
          }}
        >
          {/* Column headers */}
          <div className="adj-matrix-corner"></div>
          {displayAirports.map((code, colIdx) => (
            <div key={`col-${code}`} className="adj-matrix-header-cell">
              {code}
            </div>
          ))}

          {/* Matrix rows */}
          {displayIndices.map((rowIdx, displayRowIdx) => {
            const rowAirport = displayAirports[displayRowIdx];
            return (
              <React.Fragment key={`row-${rowAirport}`}>
                {/* Row header */}
                <div className="adj-matrix-header-cell adj-matrix-row-header">
                  {rowAirport}
                </div>

                {/* Matrix cells */}
                {displayIndices.map((colIdx, displayColIdx) => {
                  const colAirport = displayAirports[displayColIdx];
                  const cellValue = matrix[rowIdx] && matrix[rowIdx][colIdx] ? matrix[rowIdx][colIdx] : 0;
                  const hasConnection = cellValue > 0;
                  const isHovered =
                    hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                  const isSameCell = rowIdx === colIdx;

                  return (
                    <div
                      key={`cell-${rowIdx}-${colIdx}`}
                      className={`adj-matrix-cell ${
                        hasConnection ? "has-connection" : ""
                      } ${isHovered ? "hovered" : ""} ${isSameCell ? "diagonal" : ""}`}
                      onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={
                        isSameCell
                          ? `${rowAirport} → ${rowAirport} (self-loop)`
                          : hasConnection
                          ? `${rowAirport} → ${colAirport}: $${cellValue.toFixed(0)}`
                          : `${rowAirport} → ${colAirport} (no flight)`
                      }
                    >
                      {hasConnection ? `$${cellValue.toFixed(0)}` : "-"}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="adj-matrix-legend">
        <div className="legend-item">
          <div className="legend-color has-connection"></div>
          <span>Price shown</span>
        </div>
        <div className="legend-item">
          <div className="legend-color"></div>
          <span>No connection (-)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color diagonal"></div>
          <span>Diagonal (self-loops)</span>
        </div>
      </div>

      {/* DSA Explanation Footer */}
      <div className="adj-matrix-explanation">
        <p>
          <strong>Adjacency Matrix:</strong> 2D grid where matrix[i][j] = price (weight) if flight exists from airport i to j, 0 otherwise. Shows cheapest price if multiple flights exist. 
          Space: O(V²), Edge lookup: O(1). Efficient for dense graphs but memory-intensive for sparse networks.
        </p>
      </div>
    </div>
  );
}
