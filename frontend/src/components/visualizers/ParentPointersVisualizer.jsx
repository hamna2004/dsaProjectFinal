import React, { useState, useEffect, useMemo } from "react";
import { simulateDijkstra } from "../../services/api";
import { fetchAirports } from "../../services/api";
import AirportDropdown from "../AirportDropDown.jsx";

/**
 * Parent Pointers Visualizer
 * 
 * DSA CONCEPT: Path Reconstruction using Parent Pointers (came_from map)
 * 
 * In Dijkstra's Algorithm:
 * - `came_from[node] = parent_node` stores the predecessor of each node
 * - When we find a better path to a node, we update: `came_from[node] = current_node`
 * - To reconstruct the path: start at destination, follow `came_from` pointers backwards to source
 * 
 * Path Reconstruction Algorithm:
 *   1. Start at destination node
 *   2. While current node exists in came_from:
 *      - Add current node to path
 *      - Move to came_from[current]
 *   3. Reverse the path to get source → destination
 * 
 * Time Complexity: O(V) where V = path length (number of nodes in path)
 * Space Complexity: O(V) to store the came_from map
 * 
 * This visualizer shows the ACTUAL came_from map during Dijkstra's execution
 */
export default function ParentPointersVisualizer() {
  const [airports, setAirports] = useState([]);
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [mode, setMode] = useState("cheapest");
  const [simulationData, setSimulationData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAirports().then(setAirports);
  }, []);

  // Auto-play through steps
  useEffect(() => {
    if (!isPlaying || !simulationData || currentStep >= simulationData.states.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, simulationData.states.length - 1));
    }, 2000); // 2 seconds per step

    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, simulationData]);

  const handleSimulate = async () => {
    if (!source || !dest) {
      setError("Please select source and destination airports");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await simulateDijkstra({
        source,
        dest,
        mode,
        max_states: 500,
      });

      if (result.success && result.states && result.states.length > 0) {
        setSimulationData({
          states: result.states,
          route: result.route,
        });
        setCurrentStep(0);
      } else {
        setError(result.error || "No path found or simulation failed");
      }
    } catch (err) {
      setError(err.message || "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  // Reconstruct path from came_from map
  const reconstructPath = (cameFrom, source, dest) => {
    if (!cameFrom || !dest || !(dest in cameFrom) && dest !== source) {
      return [];
    }

    const path = [];
    let current = dest;

    // Backtrack from destination to source
    while (current && (current in cameFrom || current === source)) {
      path.push(current);
      if (current === source) break;
      current = cameFrom[current];
    }

    // Reverse to get source → destination
    return path.reverse();
  };

  const currentState = simulationData?.states[currentStep];
  const cameFrom = currentState?.came_from || {};
  const distances = currentState?.distances || {};
  const visited = currentState?.visited || [];
  const current = currentState?.current;

  // Reconstruct path if destination is reachable
  const reconstructedPath = useMemo(() => {
    if (!source || !dest || !cameFrom) return [];
    return reconstructPath(cameFrom, source, dest);
  }, [cameFrom, source, dest]);

  // Check if destination is in came_from (path exists)
  const pathExists = dest in cameFrom || dest === source;

  return (
    <div className="pp-visualizer-container">
      {/* Controls */}
      <div className="pp-controls">
        <div className="pp-control-row">
          <div className="pp-control-group">
            <label>Source:</label>
            <AirportDropdown
              airports={airports}
              value={source}
              onChange={setSource}
            />
          </div>
          <div className="pp-control-group">
            <label>Destination:</label>
            <AirportDropdown
              airports={airports}
              value={dest}
              onChange={setDest}
            />
          </div>
          <div className="pp-control-group">
            <label>Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="pp-mode-select"
            >
              <option value="cheapest">Cheapest</option>
              <option value="fastest">Fastest</option>
            </select>
          </div>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="pp-simulate-btn"
          >
            {loading ? "Simulating..." : "Simulate"}
          </button>
        </div>

        {simulationData && (
          <div className="pp-playback-controls">
            <button
              onClick={() => setCurrentStep(0)}
              disabled={currentStep === 0}
              className="pp-control-btn"
            >
              ⏮ First
            </button>
            <button
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="pp-control-btn"
            >
              ⏪ Prev
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="pp-control-btn pp-play-btn"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={() => setCurrentStep((prev) => Math.min(simulationData.states.length - 1, prev + 1))}
              disabled={currentStep >= simulationData.states.length - 1}
              className="pp-control-btn"
            >
              Next ⏩
            </button>
            <button
              onClick={() => setCurrentStep(simulationData.states.length - 1)}
              disabled={currentStep >= simulationData.states.length - 1}
              className="pp-control-btn"
            >
              Last ⏭
            </button>
            <div className="pp-step-info">
              Step {currentStep + 1} / {simulationData.states.length}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="pp-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading && (
        <div className="pp-loading">
          <div className="loading-spinner"></div>
          <p>Running Dijkstra's algorithm...</p>
        </div>
      )}

      {!loading && !error && simulationData && currentState && (
        <div className="pp-content">
          {/* Current Step Info */}
          <div className="pp-step-details">
            <div className="pp-detail-item">
              <span className="pp-detail-label">Current Node:</span>
              <span className="pp-detail-value">
                {current || "Initializing..."}
              </span>
            </div>
            <div className="pp-detail-item">
              <span className="pp-detail-label">Parent Pointers:</span>
              <span className="pp-detail-value">
                {Object.keys(cameFrom).length} nodes
              </span>
            </div>
            <div className="pp-detail-item">
              <span className="pp-detail-label">Visited:</span>
              <span className="pp-detail-value">
                {visited.length} nodes
              </span>
            </div>
            {currentState.relax && (
              <div className="pp-detail-item">
                <span className="pp-detail-label">Relaxing:</span>
                <span className="pp-detail-value">
                  {currentState.relax.edge?.from} → {currentState.relax.edge?.to}
                  {currentState.relax.updated && " ✓ Updated parent"}
                </span>
              </div>
            )}
          </div>

          <div className="pp-main-display">
            {/* Parent Pointers Map Visualization */}
            <div className="pp-map-container">
              <h4>Parent Pointers Map (came_from)</h4>
              <div className="pp-map-explanation">
                <p>
                  <strong>came_from[node] = parent</strong> - Stores which node led to each node
                </p>
              </div>
              
              {Object.keys(cameFrom).length > 0 ? (
                <div className="pp-map-grid">
                  {Object.entries(cameFrom)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([node, parent]) => {
                      const isInPath = reconstructedPath.includes(node);
                      const isCurrent = node === current;
                      const distance = distances[node]?.toFixed(1) || "∞";

                      return (
                        <div
                          key={node}
                          className={`pp-map-item ${isInPath ? "pp-in-path" : ""} ${isCurrent ? "pp-current" : ""}`}
                        >
                          <div className="pp-map-node">{node}</div>
                          <div className="pp-map-arrow">←</div>
                          <div className="pp-map-parent">{parent}</div>
                          <div className="pp-map-distance">Cost: {distance}</div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="pp-empty-map">
                  <p>No parent pointers set yet. Start simulation to see how they're built.</p>
                </div>
              )}
            </div>

            {/* Path Reconstruction Visualization */}
            <div className="pp-path-container">
              <h4>Path Reconstruction</h4>
              <div className="pp-path-explanation">
                <p>
                  <strong>Algorithm:</strong> Start at destination, follow parent pointers backwards to source
                </p>
              </div>

              {pathExists && reconstructedPath.length > 0 ? (
                <div className="pp-path-display">
                  <div className="pp-path-steps">
                    <div className="pp-path-step">
                      <div className="pp-path-step-label">Step 1:</div>
                      <div className="pp-path-step-content">
                        Start at destination: <strong>{dest}</strong>
                      </div>
                    </div>
                    
                    {reconstructedPath.slice(1, -1).map((node, idx) => (
                      <div key={idx} className="pp-path-step">
                        <div className="pp-path-step-label">Step {idx + 2}:</div>
                        <div className="pp-path-step-content">
                          came_from[{node}] = <strong>{cameFrom[node]}</strong>
                        </div>
                      </div>
                    ))}

                    {reconstructedPath.length > 1 && (
                      <div className="pp-path-step">
                        <div className="pp-path-step-label">Final:</div>
                        <div className="pp-path-step-content">
                          Reached source: <strong>{source}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Visual Path */}
                  <div className="pp-path-visual">
                    <div className="pp-path-nodes">
                      {reconstructedPath.map((node, idx) => (
                        <React.Fragment key={node}>
                          <div className={`pp-path-node ${node === source ? "pp-source" : ""} ${node === dest ? "pp-dest" : ""}`}>
                            <div className="pp-path-node-code">{node}</div>
                            {distances[node] !== undefined && (
                              <div className="pp-path-node-cost">{distances[node].toFixed(1)}</div>
                            )}
                          </div>
                          {idx < reconstructedPath.length - 1 && (
                            <div className="pp-path-arrow">→</div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="pp-path-total">
                      Total Cost: {distances[dest]?.toFixed(1) || "N/A"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pp-no-path">
                  {dest === source ? (
                    <p>Source and destination are the same.</p>
                  ) : (
                    <p>
                      Path not yet found. Destination not in came_from map.
                      {dest && !(dest in cameFrom) && (
                        <span className="pp-hint"> Keep simulating to find the path.</span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* DSA Explanation */}
          <div className="pp-explanation">
            <h5>💡 DSA Concept: Path Reconstruction with Parent Pointers</h5>
            <ul>
              <li>
                <strong>Parent Pointer (came_from):</strong> A dictionary that stores the predecessor of each node.
                When we find a better path to node B from node A, we set: <code>came_from[B] = A</code>
              </li>
              <li>
                <strong>Path Reconstruction:</strong> To get the path from source to destination:
                <ol>
                  <li>Start at destination node</li>
                  <li>Follow <code>came_from</code> pointers backwards: <code>current = came_from[current]</code></li>
                  <li>Continue until reaching source</li>
                  <li>Reverse the collected nodes to get source → destination path</li>
                </ol>
              </li>
              <li>
                <strong>Time Complexity:</strong> O(V) where V = number of nodes in the path (linear backtracking)
              </li>
              <li>
                <strong>Space Complexity:</strong> O(V) to store the came_from map for all visited nodes
              </li>
              <li>
                <strong>Why it works:</strong> Dijkstra guarantees that when we reach the destination,
                the came_from map contains the optimal path because we always update it when finding a better route.
              </li>
            </ul>
          </div>
        </div>
      )}

      {!loading && !error && !simulationData && (
        <div className="pp-placeholder">
          <div className="placeholder-icon">🔗</div>
          <h4>Parent Pointers Visualizer</h4>
          <p>Select source and destination airports, then click "Simulate" to visualize how parent pointers (came_from map) are used to reconstruct the optimal path</p>
        </div>
      )}
    </div>
  );
}
