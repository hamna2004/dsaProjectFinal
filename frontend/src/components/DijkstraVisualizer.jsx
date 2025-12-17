import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/DijkstraVisualizer.css";

/*
 Props:
  - states: array of state objects returned by backend
  - graph: optional graph object
  - source: source airport code
  - optimization: "cheapest" | "fastest" | "shortest" | "all"
  - autoplay: boolean
  - route: route object from simulation (contains path, totalPriceUSD, etc.)
*/
export default function DijkstraVisualizer({
  states = [],
  graph = null,
  source = null,
  optimization = "cheapest",
  autoplay = true,
  route = null,
  currentStep: externalCurrentStep = null,
  setCurrentStep: externalSetCurrentStep = null,
}) {
  const canvasRef = useRef(null);
  const [internalStep, setInternalStep] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(500); // ms per frame (lower = faster)
  
  // Use external step control if provided, otherwise use internal
  const currentStep = externalCurrentStep !== null ? externalCurrentStep : internalStep;
  const setCurrentStep = externalSetCurrentStep || setInternalStep;
  const frame = currentStep;

  // Determine what unit to show based on optimization mode
  const getCostLabel = (mode) => {
    switch (mode) {
      case "cheapest":
        return "Price ($)";
      case "fastest":
        return "Duration (min)";
      case "shortest":
        return "Distance (km)";
      default:
        return "Cost";
    }
  };

  // Find final path when destination is reached
  const finalPath = useMemo(() => {
    // First try to get path from route prop
    if (route && route.path) {
      return route.path;
    }
    // Fallback: try to get from last state (if backend includes it)
    if (!states || states.length === 0) return null;
    const lastState = states[states.length - 1];
    if (lastState.route && lastState.route.path) {
      return lastState.route.path;
    }
    return null;
  }, [states, route]);

  const mergedStates = useMemo(() => {
    if (states && states.length > 0) {
      const nodeSet = new Set();
      const baseEdgeMap = new Map();

      states.forEach((s) => {
        (s.visited || []).forEach((n) => nodeSet.add(n));
        (s.pq || []).forEach(([n]) => nodeSet.add(n));
        Object.keys(s.distances || {}).forEach((n) => nodeSet.add(n));
        if (s.current) nodeSet.add(s.current);
        if (s.relax?.edge && s.relax.edge.from && s.relax.edge.to) {
          const { from, to } = s.relax.edge;
          nodeSet.add(from);
          nodeSet.add(to);
          const key = `${from}-${to}`;
          if (!baseEdgeMap.has(key)) {
            baseEdgeMap.set(key, { from, to });
          }
        }
      });

      if (graph) {
        Object.keys(graph).forEach((node) => nodeSet.add(node));
        Object.entries(graph).forEach(([from, edges]) => {
          (edges || []).forEach((edge) => {
            if (edge && edge.to) {
              nodeSet.add(edge.to);
              const key = `${from}-${edge.to}`;
              if (!baseEdgeMap.has(key)) {
                baseEdgeMap.set(key, { from, to: edge.to });
              }
            }
          });
        });
      }

      const nodes = Array.from(nodeSet);
      if (!nodes.length) return states;

      // LARGER CANVAS SIZE
      const width = 700;
      const height = 500;
      const radius = Math.min(width, height) / 2 - 80;
      const nodesPos = {};
      nodes.forEach((node, idx) => {
        const angle = (2 * Math.PI * idx) / nodes.length;
        nodesPos[node] = {
          x: width / 2 + radius * Math.cos(angle),
          y: height / 2 + radius * Math.sin(angle),
        };
      });

      const baseEdges = Array.from(baseEdgeMap.values());

            // Track path being built (reconstruct from came_from)
      const reconstructPath = (state, dest) => {
        if (!state.distances || !dest || !(dest in state.distances)) return null;
        // We need to track came_from - but backend doesn't send it directly
        // So we'll use the final route if available, or reconstruct from states
        return null; // Will use finalPath from route instead
      };

      return states.map((s, idx) => {
        const activeKey = s.relax?.edge && s.relax.edge.from && s.relax.edge.to
          ? `${s.relax.edge.from}-${s.relax.edge.to}`
          : null;

        // Check if this edge is part of the path being built
        // We'll highlight edges that lead to nodes with updated distances
        const isPathEdge = (edge) => {
          if (!s.distances || !s.relax || !edge || !edge.from || !edge.to) return false;
          // If this edge was just relaxed and updated, it's part of the path
          if (activeKey === `${edge.from}-${edge.to}` && s.relax.updated) {
            return true;
          }
          return false;
        };

        return {
          ...s,
          nodesPos,
          edges: baseEdges
            .filter((edge) => edge && edge.from && edge.to) // Filter out invalid edges
            .map((edge) => ({
              ...edge,
              active: activeKey === `${edge.from}-${edge.to}` && !!s.relax?.updated,
              isPathEdge: isPathEdge(edge), // Edge that's part of the growing path
              isFinalPath: finalPath && finalPath.includes(edge.from) && finalPath.includes(edge.to) &&
                           finalPath.indexOf(edge.to) === finalPath.indexOf(edge.from) + 1,
            })),
        };
      });
    }

    if (!graph) return [];
    const nodes = Object.keys(graph || {});
    if (!nodes.length) return [];
    const width = 700;
    const height = 500;
    const radius = Math.min(width, height) / 2 - 80;
    const nodesPos = {};
    nodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / nodes.length;
      nodesPos[node] = {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      };
    });
    const edges = [];
    nodes.forEach((node) => {
      (graph[node] || []).forEach((edge) => {
        if (edge && edge.to && nodesPos[edge.to]) {
          edges.push({
            from: node,
            to: edge.to,
            active: false,
            isFinalPath: false,
          });
        }
      });
    });
    return [
      {
        nodesPos,
        edges,
        visited: source ? [source] : [],
        pq: [],
        distances: {},
        relax: null,
        current: source || null,
      },
    ];
  }, [states, graph, source, finalPath]);

  useEffect(() => {
    if (externalCurrentStep === null) {
      setCurrentStep(0);
    }
  }, [mergedStates, externalCurrentStep]);

  // Animation interval (only if using internal step control)
  useEffect(() => {
    if (externalCurrentStep !== null) return; // External control, don't auto-advance
    if (!playing || mergedStates.length <= 1) return;
    const id = setInterval(() => {
      setCurrentStep((f) => {
        const next = f + 1;
        if (next >= mergedStates.length) {
          setPlaying(false);
          return mergedStates.length - 1;
        }
        return next;
      });
    }, Math.max(50, speed));
    return () => clearInterval(id);
  }, [playing, speed, mergedStates, externalCurrentStep]);

  // Draw current state
  useEffect(() => {
    const s = mergedStates[currentStep];
    const canvas = canvasRef.current;
    if (!canvas || !s) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const nodesPos = s.nodesPos || {};

    // Draw edges (background first, then active/final on top)
    // First pass: draw all normal edges
    (s.edges || []).forEach((e) => {
      if (!e || !e.from || !e.to) return; // Skip invalid edges
      if (e.isFinalPath || e.active || e.isPathEdge) return; // Skip these for now
      const a = nodesPos[e.from];
      const b = nodesPos[e.to];
      if (!a || !b) return;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#9ca3af";
      ctx.setLineDash([]);
      ctx.stroke();
    });

    // Second pass: draw path edges (edges that led to current distances)
    (s.edges || []).forEach((e) => {
      if (!e || !e.from || !e.to) return; // Skip invalid edges
      if (!e.isPathEdge || e.isFinalPath) return;
      const a = nodesPos[e.from];
      const b = nodesPos[e.to];
      if (!a || !b) return;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#10b981"; // Green for path being built
      ctx.setLineDash([5, 5]);
      ctx.stroke();
    });

    // Third pass: draw active edge being relaxed
    (s.edges || []).forEach((e) => {
      if (!e || !e.from || !e.to) return; // Skip invalid edges
      if (!e.active || e.isFinalPath) return;
      const a = nodesPos[e.from];
      const b = nodesPos[e.to];
      if (!a || !b) return;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#f59e0b"; // Orange
      ctx.setLineDash([]);
      ctx.stroke();
    });

    // Fourth pass: draw final path (on top, most prominent)
    (s.edges || []).forEach((e) => {
      if (!e || !e.from || !e.to) return; // Skip invalid edges
      if (!e.isFinalPath) return;
      const a = nodesPos[e.from];
      const b = nodesPos[e.to];
      if (!a || !b) return;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#3b82f6"; // Blue
      ctx.setLineDash([]);
      ctx.stroke();

      // Add arrowhead
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const arrowLength = 12;
      const arrowAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(
        b.x - arrowLength * Math.cos(angle - arrowAngle),
        b.y - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.lineTo(
        b.x - arrowLength * Math.cos(angle + arrowAngle),
        b.y - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.closePath();
      ctx.fillStyle = "#3b82f6";
      ctx.fill();
    });

    // Draw nodes
    Object.keys(nodesPos).forEach((code) => {
      const p = nodesPos[code];
      const isVisited = (s.visited || []).includes(code);
      const inPQ = (s.pq || []).some(([node]) => node === code);
      const isCurrent = s.current === code;
      const isSource = source === code;
      const isDest = finalPath && finalPath.length > 0 && finalPath[finalPath.length - 1] === code;

      // Node circle - LARGER SIZES
      let radius = 12;
      let fillColor = "#6b7280"; // default gray

      if (isCurrent) {
        radius = 20;
        fillColor = "#ef4444"; // red for current
      } else if (isVisited) {
        radius = 16;
        fillColor = "#16a34a"; // green for visited
      } else if (inPQ) {
        radius = 14;
        fillColor = "#f59e0b"; // orange for in PQ
      } else {
        radius = 12;
        fillColor = "#6b7280"; // gray for unvisited
      }

      // Special styling for source/destination
      if (isSource) {
        fillColor = "#10b981"; // brighter green for source
      }
      if (isDest && isVisited) {
        fillColor = "#3b82f6"; // blue for destination when reached
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // White border for better visibility
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label - LARGER FONT
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(code, p.x, p.y - radius - 18);
    });

    // Highlight current node with pulsing ring
    if (s.current) {
      const cur = nodesPos[s.current];
      if (cur) {
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 26, 0, Math.PI * 2);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
      }
    }
  }, [currentStep, mergedStates, source, finalPath]);

  const curState = mergedStates[currentStep] || {};
  const totalSteps = mergedStates.length;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  // Check if complete: at last step and we have a route (either from prop or last state)
  const isComplete = currentStep === totalSteps - 1 && (route || curState.route);

  // Get mode display name
  const modeDisplay = {
    cheapest: "💰 CHEAPEST",
    fastest: "⚡ FASTEST",
    shortest: "📏 SHORTEST",
    all: "ALL ROUTES",
  }[optimization] || "DIJKSTRA";

  if (!mergedStates.length) {
    return (
      <div className="dijkstra-visualizer dijkstra-visualizer--empty">
        <div className="dv-empty-content">
          <div className="dv-empty-icon">🧭</div>
          <h3>Dijkstra Algorithm Visualizer</h3>
          <p>
            Select airports and click <strong>"Find Routes"</strong> to see how Dijkstra's algorithm finds the optimal path!
          </p>
          <div className="dv-empty-info">
            <p>The visualization will show:</p>
            <ul>
              <li>🟢 <strong>Green nodes</strong> = Visited airports</li>
              <li>🟡 <strong>Yellow nodes</strong> = In Priority Queue</li>
              <li>🔴 <strong>Red node</strong> = Currently processing</li>
              <li>🟠 <strong>Orange edge</strong> = Edge being relaxed</li>
              <li>🔵 <strong>Blue path</strong> = Final optimal route</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dijkstra-visualizer">
      {/* MODE BADGE */}
      <div className="dv-mode-badge">
        <span className="dv-mode-label">Algorithm Mode:</span>
        <span className="dv-mode-value">{modeDisplay}</span>
      </div>

      {/* HORIZONTAL LAYOUT: Canvas Left, Panels Right */}
      <div className="dv-main-layout">
        {/* LEFT SIDE: Canvas */}
        <div className="dv-left-section">
          <div className="dv-canvas-container">
              <canvas ref={canvasRef} width={700} height={500} />
            {isComplete && (
              <div className="dv-success-overlay">
                <div className="dv-success-message">
                  ✅ Route Found! Path: {finalPath?.join(" → ")}
                </div>
              </div>
            )}
          </div>

          {/* Controls are now in the wrapper component (DijkstraGraphVisualizer) */}
          {externalCurrentStep === null && (
          <div className="dv-controls">
            <div className="dv-buttons">
              <button
                onClick={() => { setPlaying(false); setCurrentStep(f => Math.max(0, f - 1)); }}
                className="dv-btn dv-btn-secondary"
                disabled={currentStep === 0}
              >
                ⏮ Step Back
              </button>
              <button
                onClick={() => setPlaying(p => !p)}
                className="dv-btn dv-btn-primary"
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                onClick={() => { setPlaying(false); setCurrentStep(0); }}
                className="dv-btn dv-btn-secondary"
              >
                ⏹ Reset
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setCurrentStep(totalSteps > 0 ? totalSteps - 1 : 0);
                }}
                className="dv-btn dv-btn-secondary"
                disabled={currentStep === totalSteps - 1}
              >
                ⏭ Jump End
              </button>
            </div>

            {/* SPEED SLIDER */}
            <div className="dv-speed-container">
              <label className="dv-speed-label">
                Speed: <span className="dv-speed-value">{Math.round(2000 / speed)}x</span>
                <span className="dv-speed-ms">({speed}ms/step)</span>
              </label>
              {/* Invert slider: slider value 100 = speed 2000 (slow), slider 2000 = speed 100 (fast) */}
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={2100 - speed}
                onChange={(e) => setSpeed(2100 - Number(e.target.value))}
                className="dv-speed-slider"
              />
              <div className="dv-speed-labels">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>

            {/* STEP COUNTER & PROGRESS */}
            <div className="dv-progress-container">
              <div className="dv-step-counter">
                Step <strong>{currentStep + 1}</strong> of <strong>{totalSteps}</strong>
                {curState.current && (
                  <span className="dv-current-node">
                    • Processing: <strong>{curState.current}</strong>
                  </span>
                )}
              </div>
              <div className="dv-progress-bar">
                <div
                  className="dv-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* LEGEND */}
            <div className="dv-legend">
              <div className="dv-legend-item">
                <div className="dv-legend-color" style={{ backgroundColor: "#16a34a" }}></div>
                <span>Visited</span>
              </div>
              <div className="dv-legend-item">
                <div className="dv-legend-color" style={{ backgroundColor: "#f59e0b" }}></div>
                <span>In Queue</span>
              </div>
              <div className="dv-legend-item">
                <div className="dv-legend-color" style={{ backgroundColor: "#ef4444" }}></div>
                <span>Current</span>
              </div>
              <div className="dv-legend-item">
                <div className="dv-legend-color" style={{ backgroundColor: "#6b7280" }}></div>
                <span>Unvisited</span>
              </div>
              <div className="dv-legend-item">
                <div className="dv-legend-line" style={{ borderColor: "#3b82f6", borderWidth: "3px" }}></div>
                <span>Final Path</span>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* RIGHT SIDE: Panels */}
        <div className="dv-right-section">
          <div className="dv-panel">
            <h4>📋 Priority Queue</h4>
            <div className="dv-pq-list">
              {(curState.pq || []).length === 0 ? (
                <div className="dv-empty-list">Queue is empty</div>
              ) : (
                (curState.pq || []).slice(0, 15).map(([node, cost], i) => (
                  <div
                    key={`${node}-${i}`}
                    className={`dv-pq-item ${i === 0 ? "dv-pq-top" : ""}`}
                  >
                    <span className="dv-pq-node">{node}</span>
                    <span className="dv-pq-cost">{Number(cost).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dv-panel">
            <h4>📊 Distances ({getCostLabel(optimization)})</h4>
            <div className="dv-distances-list">
              {Object.keys(curState.distances || {}).length === 0 ? (
                <div className="dv-empty-list">No distances yet</div>
              ) : (
                Object.entries(curState.distances || {})
                  .sort(([, a], [, b]) => a - b)
                  .slice(0, 20)
                  .map(([node, cost]) => {
                    const isUpdated = curState.relax?.edge?.to === node && curState.relax?.updated;
                    return (
                      <div
                        key={node}
                        className={`dv-distance-item ${isUpdated ? "dv-distance-updated" : ""}`}
                      >
                        <span className="dv-distance-node">{node}</span>
                        <span className="dv-distance-cost">{Number(cost).toFixed(2)}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="dv-panel">
            <h4>🔄 Edge Relaxation</h4>
            <div className="dv-relax-info">
              {curState.relax && curState.relax.edge && curState.relax.edge.from && curState.relax.edge.to ? (
                <>
                  <div className="dv-relax-edge">
                    <strong>Edge:</strong> {curState.relax.edge.from} → {curState.relax.edge.to}
                  </div>
                  {curState.relax.edge.flight_no && (
                    <div className="dv-relax-flight">
                      <strong>Flight:</strong> {curState.relax.edge.flight_no}
                    </div>
                  )}
                  <div className={`dv-relax-status ${curState.relax.updated ? "dv-relax-updated" : "dv-relax-skipped"}`}>
                    {curState.relax.updated ? "✅ Updated" : "⏭ Skipped"}
                  </div>
                  {curState.relax.new_cost !== null && curState.relax.updated && (
                    <div className="dv-relax-cost">
                      <strong>New {getCostLabel(optimization)}:</strong> {Number(curState.relax.new_cost).toFixed(2)}
                    </div>
                  )}
                </>
              ) : (
                <div className="dv-empty-list">No edge being relaxed</div>
              )}
            </div>
          </div>

          {/* PATH EXPLANATION PANEL - NEW */}
          {finalPath && frame === totalSteps - 1 && (
            <div className="dv-panel dv-explanation-panel">
              <h4>📖 How This Path Was Chosen</h4>
              <div className="dv-explanation-content">
                <p>
                  Dijkstra's algorithm found the <strong>{optimization}</strong> route by:
                </p>
                <ol className="dv-explanation-steps">
                  <li>Starting from <strong>{source}</strong> with cost 0</li>
                  <li>Exploring neighbors and updating costs</li>
                  <li>Always picking the node with lowest cost from the queue</li>
                  <li>Stopping when <strong>{finalPath[finalPath.length - 1]}</strong> was reached</li>
                </ol>
                <div className="dv-explanation-path">
                  <strong>Final Path:</strong>
                  <div className="dv-path-highlight">
                    {finalPath.join(" → ")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PATH TRACE PANEL - NEW */}
          {finalPath && (
            <div className="dv-panel dv-path-panel">
              <h4>🎯 Final Path Found</h4>
              <div className="dv-path-display">
                <div className="dv-path-sequence">
                  {finalPath.map((node, idx) => (
                    <React.Fragment key={node}>
                      <div className={`dv-path-node ${idx === 0 ? "dv-path-start" : idx === finalPath.length - 1 ? "dv-path-end" : "dv-path-stop"}`}>
                        {node}
                      </div>
                      {idx < finalPath.length - 1 && (
                        <div className="dv-path-arrow">→</div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                {(route || curState.route) && (
                  <div className="dv-path-stats">
                    <div className="dv-path-stat">
                      <strong>Total {getCostLabel(optimization)}:</strong> {
                        optimization === "cheapest" ? `$${(route?.totalPriceUSD || curState.route?.totalPriceUSD || 0).toFixed(2)}` :
                        optimization === "fastest" ? `${route?.totalDurationMin || curState.route?.totalDurationMin || 0} min` :
                        `${(route?.totalDistanceKM || curState.route?.totalDistanceKM || 0).toFixed(2)} km`
                      }
                    </div>
                    <div className="dv-path-stat">
                      <strong>Stops:</strong> {(route?.stops ?? curState.route?.stops ?? (finalPath ? finalPath.length - 2 : 0))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}