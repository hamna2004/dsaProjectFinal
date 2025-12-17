import React, { useState, useEffect } from "react";
import { compareDijkstraPerformance } from "../../services/api";
import { fetchAirports } from "../../services/api";
import AirportDropdown from "../AirportDropDown.jsx";

/**
 * Performance Comparison Visualizer
 * 
 * DSA CONCEPT: Time Complexity Comparison
 * 
 * Array-Based Dijkstra: O(V²)
 * - Extract minimum: O(V) - must scan all unvisited nodes
 * - Done V times: O(V × V) = O(V²)
 * - Simple to implement but slow for large graphs
 * 
 * Heap-Based Dijkstra: O((V + E) log V)
 * - Extract minimum: O(log V) - heap extract-min
 * - Insert/update: O(log V) - heap insert/decrease-key
 * - Done V times for extract, E times for relax: O((V + E) log V)
 * - More complex but much faster for sparse graphs (E much less than V²)
 * 
 * This visualizer shows the ACTUAL performance difference
 */
export default function AlgorithmComparisonVisualizer() {
  const [airports, setAirports] = useState([]);
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [mode, setMode] = useState("cheapest");
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAirports().then(setAirports);
  }, []);

  const handleCompare = async () => {
    if (!source || !dest) {
      setError("Please select source and destination airports");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await compareDijkstraPerformance({
        source,
        dest,
        mode,
      });

      if (result.success) {
        setComparisonData(result);
      } else {
        setError(result.error || "Comparison failed");
      }
    } catch (err) {
      setError(err.message || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const arrayData = comparisonData?.array_based;
  const heapData = comparisonData?.heap_based;
  const comparison = comparisonData?.comparison;

  return (
    <div className="perf-visualizer-container">
      {/* Controls */}
      <div className="perf-controls">
        <div className="perf-control-row">
          <div className="perf-control-group">
            <label>Source:</label>
            <AirportDropdown
              airports={airports}
              value={source}
              onChange={setSource}
            />
          </div>
          <div className="perf-control-group">
            <label>Destination:</label>
            <AirportDropdown
              airports={airports}
              value={dest}
              onChange={setDest}
            />
          </div>
          <div className="perf-control-group">
            <label>Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="perf-mode-select"
            >
              <option value="cheapest">Cheapest</option>
              <option value="fastest">Fastest</option>
            </select>
          </div>
          <button
            onClick={handleCompare}
            disabled={loading}
            className="perf-compare-btn"
          >
            {loading ? "Comparing..." : "Compare Performance"}
          </button>
        </div>
      </div>

      {error && (
        <div className="perf-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading && (
        <div className="perf-loading">
          <div className="loading-spinner"></div>
          <p>Running both algorithms and measuring performance...</p>
        </div>
      )}

      {!loading && !error && comparisonData && (
        <div className="perf-content">
          {/* Graph Statistics */}
          <div className="perf-graph-stats">
            <div className="perf-stat-card">
              <div className="perf-stat-label">Vertices (Airports)</div>
              <div className="perf-stat-value">{arrayData?.vertices || 0}</div>
            </div>
            <div className="perf-stat-card">
              <div className="perf-stat-label">Edges (Flights)</div>
              <div className="perf-stat-value">{arrayData?.edges || 0}</div>
            </div>
            <div className="perf-stat-card">
              <div className="perf-stat-label">Graph Density</div>
              <div className="perf-stat-value">
                {arrayData?.vertices
                  ? ((arrayData.edges / (arrayData.vertices * (arrayData.vertices - 1))) * 100).toFixed(2)
                  : 0}
                %
              </div>
            </div>
          </div>

          {/* Comparison Results */}
          <div className="perf-comparison-grid">
            {/* Array-Based Results */}
            <div className="perf-algorithm-card">
              <div className="perf-algorithm-header">
                <h3>📊 Array-Based Dijkstra</h3>
                <div className="perf-complexity-badge perf-badge-array">
                  O(V²)
                </div>
              </div>
              
              <div className="perf-metrics">
                <div className="perf-metric">
                  <div className="perf-metric-label">Execution Time</div>
                  <div className="perf-metric-value perf-time">
                    {arrayData?.execution_time_ms?.toFixed(2) || "N/A"} ms
                  </div>
                </div>
                
                <div className="perf-metric">
                  <div className="perf-metric-label">Extract-Min Operations</div>
                  <div className="perf-metric-value">
                    {arrayData?.operations?.extract_min_ops || 0}
                  </div>
                </div>
                
                <div className="perf-metric">
                  <div className="perf-metric-label">Relax Operations</div>
                  <div className="perf-metric-value">
                    {arrayData?.operations?.relax_ops || 0}
                  </div>
                </div>
                
                <div className="perf-metric">
                  <div className="perf-metric-label">Comparisons</div>
                  <div className="perf-metric-value">
                    {arrayData?.operations?.comparisons || 0}
                  </div>
                </div>
                
                <div className="perf-metric">
                  <div className="perf-metric-label">Path Found</div>
                  <div className={`perf-metric-value ${arrayData?.found_path ? "perf-success" : "perf-fail"}`}>
                    {arrayData?.found_path ? "✓ Yes" : "✗ No"}
                  </div>
                </div>
              </div>

              <div className="perf-algorithm-explanation">
                <p>
                  <strong>How it works:</strong> Scans all unvisited nodes to find minimum (O(V)) each iteration.
                  Total: O(V²) time complexity.
                </p>
              </div>
            </div>

            {/* Heap-Based Results */}
            <div className="perf-algorithm-card">
              <div className="perf-algorithm-header">
                <h3>⚡ Heap-Based Dijkstra</h3>
                <div className="perf-complexity-badge perf-badge-heap">
                  O((V + E) log V)
                </div>
              </div>
              
              <div className="perf-metrics">
                <div className="perf-metric">
                  <div className="perf-metric-label">Execution Time</div>
                  <div className="perf-metric-value perf-time">
                    {heapData?.execution_time_ms?.toFixed(2) || "N/A"} ms
                  </div>
                </div>
                
                <div className="perf-metric">
                  <div className="perf-metric-label">Extract-Min Operations</div>
                  <div className="perf-metric-value">
                    {heapData?.operations?.extract_min_ops || 0}
                  </div>
                </div>
                
                <div className="perf-metric">
                  <div className="perf-metric-label">Relax Operations</div>
                  <div className="perf-metric-value">
                    {heapData?.operations?.relax_ops || 0}
                  </div>
                </div>
                
                <div className="perf-metric">
                  <div className="perf-metric-label">Heap Operations</div>
                  <div className="perf-metric-value">
                    {heapData?.operations?.heap_operations || 0}
                  </div>
                </div>
                
                <div className="perf-metric">
                  <div className="perf-metric-label">Path Found</div>
                  <div className={`perf-metric-value ${heapData?.found_path ? "perf-success" : "perf-fail"}`}>
                    {heapData?.found_path ? "✓ Yes" : "✗ No"}
                  </div>
                </div>
              </div>

              <div className="perf-algorithm-explanation">
                <p>
                  <strong>How it works:</strong> Uses min-heap for O(log V) extract-min and insert operations.
                  Total: O((V + E) log V) time complexity.
                </p>
              </div>
            </div>
          </div>

          {/* Speedup Visualization */}
          {comparison && comparison.speedup > 0 && (
            <div className="perf-speedup-section">
              <h4>Performance Comparison</h4>
              <div className="perf-speedup-visual">
                <div className="perf-speedup-bar-container">
                  <div className="perf-speedup-label">Array-Based</div>
                  <div className="perf-speedup-bar">
                    <div
                      className="perf-speedup-fill perf-fill-array"
                      style={{ width: "100%" }}
                    >
                      {arrayData?.execution_time_ms?.toFixed(2)} ms
                    </div>
                  </div>
                </div>
                
                <div className="perf-speedup-bar-container">
                  <div className="perf-speedup-label">Heap-Based</div>
                  <div className="perf-speedup-bar">
                    <div
                      className="perf-speedup-fill perf-fill-heap"
                      style={{
                        width: `${Math.min((heapData?.execution_time_ms / arrayData?.execution_time_ms) * 100, 100)}%`,
                      }}
                    >
                      {heapData?.execution_time_ms?.toFixed(2)} ms
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="perf-speedup-result">
                <div className="perf-speedup-badge">
                  <span className="perf-speedup-label-large">Speedup:</span>
                  <span className="perf-speedup-value">
                    {comparison.speedup.toFixed(2)}x faster
                  </span>
                </div>
                <p className="perf-speedup-description">
                  Heap-based Dijkstra is <strong>{comparison.speedup.toFixed(2)}x</strong> faster than array-based
                  for this graph with {arrayData?.vertices} vertices and {arrayData?.edges} edges.
                </p>
              </div>
            </div>
          )}

          {/* Complexity Comparison */}
          <div className="perf-complexity-section">
            <h4>Time & Space Complexity</h4>
            <div className="perf-complexity-grid">
              <div className="perf-complexity-card">
                <h5>Array-Based</h5>
                <div className="perf-complexity-item">
                  <span className="perf-complexity-label">Time:</span>
                  <code>{comparison?.time_complexity_array}</code>
                </div>
                <div className="perf-complexity-item">
                  <span className="perf-complexity-label">Space:</span>
                  <code>{comparison?.space_complexity_array}</code>
                </div>
                <div className="perf-complexity-note">
                  Best for: Dense graphs (E ≈ V²) or small graphs
                </div>
              </div>
              
              <div className="perf-complexity-card">
                <h5>Heap-Based</h5>
                <div className="perf-complexity-item">
                  <span className="perf-complexity-label">Time:</span>
                  <code>{comparison?.time_complexity_heap}</code>
                </div>
                <div className="perf-complexity-item">
                  <span className="perf-complexity-label">Space:</span>
                  <code>{comparison?.space_complexity_heap}</code>
                </div>
                <div className="perf-complexity-note">
                  Best for: Sparse graphs (E &lt;&lt; V²) or large graphs
                </div>
              </div>
            </div>
          </div>

          {/* DSA Explanation */}
          <div className="perf-explanation">
            <h5>💡 DSA Concept: Why Heap is Faster</h5>
            <ul>
              <li>
                <strong>Array-Based Extract-Min:</strong> Must scan all V unvisited nodes to find minimum.
                This is O(V) and done V times → O(V²) total.
              </li>
              <li>
                <strong>Heap-Based Extract-Min:</strong> Root of min-heap is always minimum.
                Extract is O(log V) and done V times → O(V log V) for extracts.
              </li>
              <li>
                <strong>Edge Relaxation:</strong> Array-based doesn't need special handling,
                but heap-based needs O(log V) insert/update per edge → O(E log V) for relaxations.
              </li>
              <li>
                <strong>Total Complexity:</strong> Array = O(V²), Heap = O((V + E) log V).
                For sparse graphs (E much less than V²), heap is significantly faster.
              </li>
              <li>
                <strong>When to use each:</strong> Array-based is simpler but only practical for small/dense graphs.
                Heap-based is the standard for most real-world applications.
              </li>
            </ul>
          </div>
        </div>
      )}

      {!loading && !error && !comparisonData && (
        <div className="perf-placeholder">
          <div className="placeholder-icon">⚡</div>
          <h4>Performance Comparison</h4>
          <p>
            Select source and destination airports, then click "Compare Performance" to see
            the difference between array-based (O(V²)) and heap-based (O((V + E) log V)) Dijkstra implementations
          </p>
        </div>
      )}
    </div>
  );
}
