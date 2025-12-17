import React, { useState, useEffect, useRef, useMemo } from "react";
import { simulateMST, fetchAirports, fetchRouteGraphAnalysis } from "../../services/api";
import AirportDropdown from "../AirportDropDown.jsx";
import "../../styles/DijkstraVisualizer.css";

export default function MSTVisualizer() {
  const [airports, setAirports] = useState([]);
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [algorithm, setAlgorithm] = useState("prim");
  const [simulationData, setSimulationData] = useState(null);
  const [allGraphEdges, setAllGraphEdges] = useState([]); // All edges in the graph
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

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
    }, 1500); // 1.5 seconds per step

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
      // First, fetch all graph edges (like GraphNetworkVisualizer does)
      const routeAnalysisResult = await fetchRouteGraphAnalysis(source, dest);
      
      // Then fetch MST simulation
      const result = await simulateMST({
        source,
        dest,
        algorithm,
        max_states: 500,
      });

      if (result.success && result.states && result.states.length > 0) {
        // Store all graph edges for visualization
        if (routeAnalysisResult?.success && routeAnalysisResult.data?.subgraph?.edges) {
          setAllGraphEdges(routeAnalysisResult.data.subgraph.edges);
        }
        
        setSimulationData({
          states: result.states,
          mst_edges: result.mst_edges,
          airports: result.airports,
          algorithm: result.algorithm || algorithm,
        });
        setCurrentStep(0);
        setIsPlaying(true); // Auto-start visualization
      } else {
        setError(result.error || "No MST found or simulation failed");
      }
    } catch (err) {
      setError(err.message || "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  // Draw graph visualization
  useEffect(() => {
    if (!simulationData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, width, height);

    const state = simulationData.states[currentStep];
    if (!state) return;

    const allAirports = simulationData.airports || [];
    if (allAirports.length === 0) return;

    // Calculate node positions in circular layout
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    const nodePositions = {};
    const nodeRadius = 25;

    allAirports.forEach((airport, idx) => {
      const angle = (2 * Math.PI * idx) / allAirports.length - Math.PI / 2;
      nodePositions[airport] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Use all graph edges (from route analysis) instead of just MST edges
    // This shows the complete graph first, then highlights MST edges
    const edgesToDraw = allGraphEdges.length > 0 ? allGraphEdges : [];
    
    // If no graph edges loaded yet, fall back to MST edges
    if (edgesToDraw.length === 0) {
      simulationData.states.forEach((s) => {
        if (s.mst_edges) {
          s.mst_edges.forEach((e) => {
            edgesToDraw.push({
              from: e.from,
              to: e.to,
              price: e.weight,
            });
          });
        }
      });
    }

    // Create a set of MST edges in canonical form (sorted) for efficient lookup
    const mstEdgeSet = new Set();
    if (state.mst_edges) {
      state.mst_edges.forEach((e) => {
        // Store in canonical form (sorted) for undirected graph
        const edgeKey = [e.from, e.to].sort().join('-');
        mstEdgeSet.add(edgeKey);
      });
    }

    // Draw edges first (behind nodes)
    edgesToDraw.forEach((edge) => {
      const fromPos = nodePositions[edge.from];
      const toPos = nodePositions[edge.to];
      if (!fromPos || !toPos) return;

      // Check if this edge is in the MST (undirected check using canonical form)
      const edgeKey = [edge.from, edge.to].sort().join('-');
      const isInMST = mstEdgeSet.has(edgeKey);
      
      // Check if this is the current edge being considered (undirected check)
      const isCurrentEdge = state.edge && (() => {
        const currentEdgeKey = [state.edge.from, state.edge.to].sort().join('-');
        return currentEdgeKey === edgeKey;
      })();

      // Calculate angle and edge end position (undirected - no arrows)
      const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
      const edgeOffset = nodeRadius;
      const edgeStartX = fromPos.x + edgeOffset * Math.cos(angle);
      const edgeStartY = fromPos.y + edgeOffset * Math.sin(angle);
      const edgeEndX = toPos.x - edgeOffset * Math.cos(angle);
      const edgeEndY = toPos.y - edgeOffset * Math.sin(angle);

      // Draw undirected edge line (no arrows for MST)
      ctx.beginPath();
      ctx.moveTo(edgeStartX, edgeStartY);
      ctx.lineTo(edgeEndX, edgeEndY);
      ctx.strokeStyle = isInMST
        ? "#10b981"
        : isCurrentEdge
        ? "#f4bc3b"
        : "#cbd5e1";
      ctx.lineWidth = isInMST ? 3 : isCurrentEdge ? 2.5 : 1.5;
      ctx.setLineDash(isInMST ? [] : [5, 5]);
      ctx.stroke();

      // Draw price label for all edges
      const midX = (fromPos.x + toPos.x) / 2;
      const midY = (fromPos.y + toPos.y) / 2;
      
      // Get weight from edge or MST
      let weight = edge.price || 0;
      if (isInMST) {
        // Find MST edge using canonical form
        const mstEdge = state.mst_edges?.find((e) => {
          const eKey = [e.from, e.to].sort().join('-');
          return eKey === edgeKey;
        });
        weight = mstEdge?.weight || weight;
      } else if (isCurrentEdge) {
        weight = state.edge?.weight || weight;
      }

      // Background for text
      const weightText = `$${weight.toFixed(0)}`;
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const textMetrics = ctx.measureText(weightText);
      const textWidth = textMetrics.width;
      const textHeight = 14;

      // Draw background rectangle
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(
        midX - textWidth / 2 - 4,
        midY - textHeight / 2 - 2,
        textWidth + 8,
        textHeight + 4
      );

      // Draw border
      ctx.strokeStyle = isInMST ? "#10b981" : isCurrentEdge ? "#f4bc3b" : "#94a3b8";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        midX - textWidth / 2 - 4,
        midY - textHeight / 2 - 2,
        textWidth + 8,
        textHeight + 4
      );

      // Draw text
      ctx.fillStyle = isInMST ? "#065f46" : isCurrentEdge ? "#92400e" : "#475569";
      ctx.fillText(weightText, midX, midY);
    });

    // Draw nodes
    allAirports.forEach((airport) => {
      const pos = nodePositions[airport];
      if (!pos) return;

      const isSource = airport === source;
      const isDest = airport === dest;
      const isVisited = state.visited?.includes(airport);
      const isCurrent = state.current_node === airport;

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);

      if (isSource) {
        ctx.fillStyle = "#10b981"; // Green for source
      } else if (isDest) {
        ctx.fillStyle = "#3b82f6"; // Blue for destination
      } else if (isVisited) {
        ctx.fillStyle = "#f4bc3b"; // Yellow for visited
      } else {
        ctx.fillStyle = "#ffffff";
      }
      ctx.fill();

      // Border
      ctx.strokeStyle = isSource
        ? "#059669"
        : isDest
        ? "#2563eb"
        : isVisited
        ? "#d97706"
        : "#1d3f3b";
      ctx.lineWidth = isCurrent ? 4 : 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(airport, pos.x, pos.y);
    });
  }, [simulationData, currentStep, source, dest, allGraphEdges]);

  return (
    <div className="mst-visualizer">
      {/* Controls */}
      <div className="mst-controls">
        <div className="mst-control-row">
          <div className="mst-control-group">
            <label>Source Airport:</label>
            <AirportDropdown
              airports={airports}
              value={source}
              onChange={setSource}
            />
          </div>
          <div className="mst-control-group">
            <label>Destination Airport:</label>
            <AirportDropdown
              airports={airports}
              value={dest}
              onChange={setDest}
            />
          </div>
          <div className="mst-control-group">
            <label>Algorithm:</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="mst-algorithm-select"
            >
              <option value="prim">Prim's Algorithm</option>
              <option value="kruskal">Kruskal's Algorithm</option>
            </select>
          </div>
          <button
            className="mst-simulate-btn"
            onClick={handleSimulate}
            disabled={!source || !dest || loading}
          >
            {loading ? "Simulating..." : "Simulate MST"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mst-error">
          <p>{error}</p>
        </div>
      )}

      {simulationData && (
        <>
          {/* Canvas */}
          <div className="mst-canvas-wrapper">
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              className="mst-canvas"
            />
          </div>

          {/* Controls */}
          <div className="mst-playback-controls">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="mst-play-btn"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={() => setCurrentStep(0)}
              className="mst-control-btn"
              disabled={currentStep === 0}
            >
              ⏮ First
            </button>
            <button
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              className="mst-control-btn"
              disabled={currentStep === 0}
            >
              ⏪ Prev
            </button>
            <span className="mst-step-info">
              Step {currentStep + 1} / {simulationData.states.length}
            </span>
            <button
              onClick={() =>
                setCurrentStep((prev) =>
                  Math.min(simulationData.states.length - 1, prev + 1)
                )
              }
              className="mst-control-btn"
              disabled={currentStep >= simulationData.states.length - 1}
            >
              Next ⏩
            </button>
            <button
              onClick={() =>
                setCurrentStep(simulationData.states.length - 1)
              }
              className="mst-control-btn"
              disabled={currentStep >= simulationData.states.length - 1}
            >
              Last ⏭
            </button>
          </div>

          {/* Statistics */}
          {simulationData.states[currentStep] && (
            <div className="mst-stats">
              <div className="mst-stat-item">
                <span className="mst-stat-label">Algorithm:</span>
                <span className="mst-stat-value">
                  {simulationData.algorithm === "prim"
                    ? "Prim's"
                    : "Kruskal's"}
                </span>
              </div>
              <div className="mst-stat-item">
                <span className="mst-stat-label">MST Edges:</span>
                <span className="mst-stat-value">
                  {simulationData.states[currentStep].mst_edges?.length || 0}
                </span>
              </div>
              <div className="mst-stat-item">
                <span className="mst-stat-label">Visited Nodes:</span>
                <span className="mst-stat-value">
                  {simulationData.states[currentStep].visited?.length || 0}
                </span>
              </div>
              {simulationData.states[currentStep].total_cost && (
                <div className="mst-stat-item">
                  <span className="mst-stat-label">Total Cost:</span>
                  <span className="mst-stat-value">
                    ${simulationData.states[currentStep].total_cost.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!simulationData && !loading && (
        <div className="mst-placeholder">
          <p>Select source and destination airports, then click "Simulate MST"</p>
        </div>
      )}
    </div>
  );
}
