import React, { useState, useEffect, useMemo } from "react";
import { simulateDijkstra } from "../../services/api";
import { fetchAirports } from "../../services/api";
import AirportDropdown from "../AirportDropDown.jsx";

/**
 * Priority Queue (Min-Heap) Visualizer
 * 
 * DSA CONCEPT: Min-Heap (Binary Heap)
 * 
 * A min-heap is a complete binary tree where:
 * - Parent nodes have values ≤ their children (min-heap property)
 * - Complete binary tree: all levels filled except possibly the last, filled left-to-right
 * - Stored as an array: parent at index i, children at 2i+1 and 2i+2
 * 
 * In Dijkstra's Algorithm:
 * - Priority Queue stores (cost, node) tuples
 * - Always extracts the node with minimum cost (O(log n))
 * - Inserts new nodes with their costs (O(log n))
 * - Time complexity: O((V + E) log V) where V = vertices, E = edges
 * 
 * This visualizer shows the ACTUAL heap structure during Dijkstra's execution
 */
export default function PriorityQueueTreeVisualizer() {
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
    }, 2000); // Slower speed: 2 seconds per step

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
        setIsPlaying(true); // Auto-start visualization
      } else {
        setError(result.error || "No path found or simulation failed");
      }
    } catch (err) {
      setError(err.message || "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  // Convert PQ array to binary tree structure for visualization
  const buildHeapTree = (pqArray) => {
    if (!pqArray || pqArray.length === 0) return null;

    // pqArray is [(node, cost), ...] sorted by cost
    const nodes = pqArray.map(([node, cost], idx) => ({
      id: idx,
      node,
      cost,
      left: null,
      right: null,
    }));

    // Build tree structure: parent at i, children at 2i+1 and 2i+2
    for (let i = 0; i < nodes.length; i++) {
      const leftIdx = 2 * i + 1;
      const rightIdx = 2 * i + 2;

      if (leftIdx < nodes.length) {
        nodes[i].left = nodes[leftIdx];
      }
      if (rightIdx < nodes.length) {
        nodes[i].right = nodes[rightIdx];
      }
    }

    return nodes[0]; // Return root
  };

  // Calculate tree dimensions for proper spacing
  const calculateTreeDimensions = (root, level = 0) => {
    if (!root) return { width: 0, height: 0 };
    
    const leftDims = calculateTreeDimensions(root.left, level + 1);
    const rightDims = calculateTreeDimensions(root.right, level + 1);
    
    const nodeWidth = 100;
    const minSpacing = 20;
    const width = Math.max(
      leftDims.width + rightDims.width + minSpacing,
      nodeWidth
    );
    const height = Math.max(leftDims.height, rightDims.height) + 1;
    
    return { width, height };
  };

  // Calculate positions for all nodes to prevent overlap (improved algorithm)
  const calculateNodePositions = (root, level = 0, x = 0, y = 0, positions = {}) => {
    if (!root) return positions;

    const nodeWidth = 100;
    const nodeHeight = 70;
    const verticalSpacing = 130;
    const minHorizontalSpacing = 140; // Increased spacing

    // Calculate subtree widths more accurately
    const leftDims = root.left ? calculateTreeDimensions(root.left) : { width: 0 };
    const rightDims = root.right ? calculateTreeDimensions(root.right) : { width: 0 };

    // Store current node position
    positions[root.id] = { x, y, node: root };

    const nextY = y + verticalSpacing;

    // Calculate spacing based on subtree widths to prevent overlap
    const leftSpacing = Math.max(leftDims.width / 2 + minHorizontalSpacing / 2, minHorizontalSpacing);
    const rightSpacing = Math.max(rightDims.width / 2 + minHorizontalSpacing / 2, minHorizontalSpacing);

    // Position left child - ensure enough space for its subtree
    if (root.left) {
      const leftX = x - rightSpacing - (rightDims.width > 0 ? rightDims.width / 2 : 0);
      calculateNodePositions(root.left, level + 1, leftX, nextY, positions);
    }

    // Position right child - ensure enough space for its subtree
    if (root.right) {
      const rightX = x + leftSpacing + (leftDims.width > 0 ? leftDims.width / 2 : 0);
      calculateNodePositions(root.right, level + 1, rightX, nextY, positions);
    }

    return positions;
  };

  // Render tree node using pre-calculated positions
  const renderTreeNode = (node, positions, nodeWidth = 100, nodeHeight = 70) => {
    if (!node || !positions[node.id]) return null;

    const pos = positions[node.id];
    const x = pos.x;
    const y = pos.y;

    const currentState = simulationData?.states[currentStep];
    const isMinNode = currentState?.pq?.[0]?.[0] === node.node;

    // Get children positions
    const leftPos = node.left ? positions[node.left.id] : null;
    const rightPos = node.right ? positions[node.right.id] : null;

    return (
      <g key={node.id}>
        {/* Draw connections to children */}
        {leftPos && (
          <line
            x1={x}
            y1={y + nodeHeight / 2}
            x2={leftPos.x}
            y2={leftPos.y}
            stroke="#1d3f3b"
            strokeWidth="2"
          />
        )}
        {rightPos && (
          <line
            x1={x}
            y1={y + nodeHeight / 2}
            x2={rightPos.x}
            y2={rightPos.y}
            stroke="#1d3f3b"
            strokeWidth="2"
          />
        )}

        {/* Draw node */}
        <g>
          <rect
            x={x - nodeWidth / 2}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            fill={isMinNode ? "#f4bc3b" : "#e9f5f1"}
            stroke={isMinNode ? "#1d3f3b" : "#cbd5e1"}
            strokeWidth={isMinNode ? "3" : "2"}
            rx="8"
          />
          <text
            x={x}
            y={y + 28}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#0f172a"
          >
            {node.node}
          </text>
          <text
            x={x}
            y={y + 50}
            textAnchor="middle"
            fontSize="12"
            fill="#5c6b70"
          >
            {node.cost.toFixed(1)}
          </text>
        </g>

        {/* Render children */}
        {node.left && renderTreeNode(node.left, positions, nodeWidth, nodeHeight)}
        {node.right && renderTreeNode(node.right, positions, nodeWidth, nodeHeight)}
      </g>
    );
  };

  const currentState = simulationData?.states[currentStep];
  const heapTree = currentState?.pq ? buildHeapTree(currentState.pq) : null;
  
  // Calculate positions for all nodes to prevent overlap
  const nodePositions = heapTree ? calculateNodePositions(heapTree, 0, 0, 50) : {};
  
  // Calculate SVG viewBox based on node positions
  const getViewBox = () => {
    if (!heapTree || Object.keys(nodePositions).length === 0) {
      return "0 0 800 400";
    }
    
    const positions = Object.values(nodePositions);
    const minX = Math.min(...positions.map(p => p.x)) - 60;
    const maxX = Math.max(...positions.map(p => p.x)) + 60;
    const minY = Math.min(...positions.map(p => p.y)) - 30;
    const maxY = Math.max(...positions.map(p => p.y)) + 100;
    
    const width = Math.max(maxX - minX, 600);
    const height = Math.max(maxY - minY, 400);
    const centerX = (minX + maxX) / 2;
    
    return `${centerX - width / 2} ${minY} ${width} ${height}`;
  };

  return (
    <div className="pq-visualizer-container">
      {/* Controls */}
      <div className="pq-controls">
        <div className="pq-control-row">
          <div className="pq-control-group">
            <label>Source:</label>
            <AirportDropdown
              airports={airports}
              value={source}
              onChange={setSource}
            />
          </div>
          <div className="pq-control-group">
            <label>Destination:</label>
            <AirportDropdown
              airports={airports}
              value={dest}
              onChange={setDest}
            />
          </div>
          <div className="pq-control-group">
            <label>Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="pq-mode-select"
            >
              <option value="cheapest">Cheapest</option>
              <option value="fastest">Fastest</option>
            </select>
          </div>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="pq-simulate-btn"
          >
            {loading ? "Simulating..." : "Simulate"}
          </button>
        </div>

        {simulationData && (
          <div className="pq-playback-controls">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="pq-control-btn pq-play-btn"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={() => setCurrentStep(0)}
              className="pq-control-btn"
              disabled={currentStep === 0}
            >
              ⏮ First
            </button>
            <button
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              className="pq-control-btn"
              disabled={currentStep === 0}
            >
              ⏪ Prev
            </button>
            <span className="pq-step-info">
              Step {currentStep + 1} / {simulationData.states.length}
            </span>
            <button
              onClick={() =>
                setCurrentStep((prev) =>
                  Math.min(simulationData.states.length - 1, prev + 1)
                )
              }
              className="pq-control-btn"
              disabled={currentStep >= simulationData.states.length - 1}
            >
              Next ⏩
            </button>
            <button
              onClick={() => setCurrentStep(simulationData.states.length - 1)}
              className="pq-control-btn"
              disabled={currentStep >= simulationData.states.length - 1}
            >
              Last ⏭
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="pq-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading && (
        <div className="pq-loading">
          <div className="loading-spinner"></div>
          <p>Running Dijkstra's algorithm...</p>
        </div>
      )}

      {!loading && !error && simulationData && currentState && (
        <div className="pq-content">
          {/* Current Step Info */}
          <div className="pq-step-details">
            <div className="pq-detail-item">
              <span className="pq-detail-label">Current Node:</span>
              <span className="pq-detail-value">
                {currentState.current || "Initializing..."}
              </span>
            </div>
            <div className="pq-detail-item">
              <span className="pq-detail-label">PQ Size:</span>
              <span className="pq-detail-value">
                {currentState.pq?.length || 0} nodes
              </span>
            </div>
            <div className="pq-detail-item">
              <span className="pq-detail-label">Visited:</span>
              <span className="pq-detail-value">
                {currentState.visited?.length || 0} nodes
              </span>
            </div>
            {currentState.relax && (
              <div className="pq-detail-item">
                <span className="pq-detail-label">Relaxing:</span>
                <span className="pq-detail-value">
                  {currentState.relax.edge?.from} → {currentState.relax.edge?.to}
                  {currentState.relax.updated && " ✓ Updated"}
                </span>
              </div>
            )}
          </div>

          {/* Heap Tree Visualization */}
          <div className="pq-tree-container">
            <h4>Min-Heap Structure (Priority Queue)</h4>
            {heapTree ? (
              <div className="pq-tree-wrapper">
                <svg
                  width="100%"
                  height="500"
                  viewBox={getViewBox()}
                  className="pq-tree-svg"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {renderTreeNode(heapTree, nodePositions)}
                </svg>
                <div className="pq-tree-legend">
                  <div className="pq-legend-item">
                    <div className="pq-legend-color" style={{ background: "#f4bc3b" }}></div>
                    <span>Minimum (next to extract)</span>
                  </div>
                  <div className="pq-legend-item">
                    <div className="pq-legend-color" style={{ background: "#e9f5f1" }}></div>
                    <span>Other nodes</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pq-empty-tree">
                <p>Priority Queue is empty</p>
              </div>
            )}

            {/* PQ Array Representation */}
            <div className="pq-array-container">
              <h5>Array Representation (Heap Storage)</h5>
              <div className="pq-array">
                {currentState.pq?.map(([node, cost], idx) => (
                  <div
                    key={idx}
                    className={`pq-array-item ${
                      idx === 0 ? "pq-array-min" : ""
                    }`}
                    title={`Index ${idx}: Parent at ${Math.floor((idx - 1) / 2)}, Children at ${2 * idx + 1} and ${2 * idx + 2}`}
                  >
                    <div className="pq-array-node">{node}</div>
                    <div className="pq-array-cost">{cost.toFixed(1)}</div>
                    <div className="pq-array-index">{idx}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DSA Explanation */}
          <div className="pq-explanation">
            <h5>💡 DSA Concept: Min-Heap Operations</h5>
            <ul>
              <li>
                <strong>Extract-Min (heappop):</strong> Removes and returns the root (minimum cost node) in O(log n) time.
                The last element moves to root, then "heapify down" maintains heap property.
              </li>
              <li>
                <strong>Insert (heappush):</strong> Adds new node at end, then "heapify up" to maintain heap property in O(log n) time.
              </li>
              <li>
                <strong>Heap Property:</strong> Parent cost ≤ children costs. Root always has minimum cost.
              </li>
              <li>
                <strong>Array Storage:</strong> Parent at index i, left child at 2i+1, right child at 2i+2.
              </li>
            </ul>
          </div>
        </div>
      )}

      {!loading && !error && !simulationData && (
        <div className="pq-placeholder">
          <div className="placeholder-icon">🌳</div>
          <h4>Priority Queue (Min-Heap) Visualizer</h4>
          <p>Select source and destination airports, then click "Simulate" to visualize the min-heap structure during Dijkstra's algorithm</p>
        </div>
      )}
    </div>
  );
}
