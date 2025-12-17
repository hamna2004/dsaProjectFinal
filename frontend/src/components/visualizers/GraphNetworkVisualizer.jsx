import React, { useEffect, useRef, useState } from "react";
import { fetchGraphStats, fetchRouteGraphAnalysis } from "../../services/api";

export default function GraphNetworkVisualizer({ source = null, dest = null }) {
  const canvasRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [routeAnalysis, setRouteAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    loadData();
  }, [source, dest]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, routeResult] = await Promise.all([
        fetchGraphStats(),
        source && dest ? fetchRouteGraphAnalysis(source, dest) : Promise.resolve(null)
      ]);

      if (statsResult.success) {
        setStats(statsResult.data);
      } else {
        setError(statsResult.error || "Failed to load stats");
      }

      if (routeResult?.success) {
        setRouteAnalysis(routeResult.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stats && canvasRef.current) {
      drawGraph();
    }
  }, [stats, routeAnalysis, selectedNode]);

  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas || !stats) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, width, height);

    // Only draw graph if we have route analysis
    if (routeAnalysis && routeAnalysis.subgraph) {
      return drawRouteSubgraph(ctx, width, height, routeAnalysis, canvas);
    }
    
    // If no airports selected, don't draw anything (just show placeholder)
    return null;
  };

  const drawRouteSubgraph = (ctx, width, height, analysis, canvas) => {
    const { subgraph, source: src, dest: dst } = analysis;
    const airports = subgraph.airports;
    const edges = subgraph.edges;

    if (airports.length === 0) return null;

    // Calculate node positions in a circular layout
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    const nodePositions = {};
    const nodeRadius = 25;

    airports.forEach((airport, idx) => {
      const angle = (2 * Math.PI * idx) / airports.length - Math.PI / 2;
      nodePositions[airport] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        airport
      };
    });

    // Draw edges first (so they appear behind nodes)
    edges.forEach(edge => {
      const fromPos = nodePositions[edge.from];
      const toPos = nodePositions[edge.to];
      if (!fromPos || !toPos) return;

      // Highlight route path edges
      const isRoutePath = isInRoutePath(edge.from, edge.to, src, dst, edges);
      
      // Calculate angle and arrow position
      const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
      const nodeRadius = 25;
      const arrowOffset = nodeRadius + 8; // Position arrow before node edge
      
      // Calculate where edge should end (before the node)
      const edgeEndX = toPos.x - arrowOffset * Math.cos(angle);
      const edgeEndY = toPos.y - arrowOffset * Math.sin(angle);
      
      // Draw edge line (stops before node)
      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.lineTo(edgeEndX, edgeEndY);
      ctx.strokeStyle = isRoutePath ? "#f4bc3b" : "#cbd5e1";
      ctx.lineWidth = isRoutePath ? 3 : 1.5;
      ctx.setLineDash(isRoutePath ? [] : [5, 5]);
      ctx.stroke();

      // Draw arrowhead - larger and more visible
      const arrowLength = 18; // Increased size
      const arrowWidth = 12; // Width of arrow base
      const arrowAngle = Math.PI / 5; // Slightly wider angle
      
      ctx.beginPath();
      ctx.moveTo(edgeEndX, edgeEndY);
      ctx.lineTo(
        edgeEndX - arrowLength * Math.cos(angle - arrowAngle),
        edgeEndY - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.lineTo(
        edgeEndX - arrowLength * Math.cos(angle + arrowAngle),
        edgeEndY - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.closePath();
      
      // Fill arrow with solid color
      ctx.fillStyle = isRoutePath ? "#f4bc3b" : "#64748b"; // Darker gray for visibility
      ctx.fill();
      
      // Add border to arrow for better visibility
      ctx.strokeStyle = isRoutePath ? "#d97706" : "#475569"; // Darker border
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw edge weight (price or duration)
      const midX = (fromPos.x + toPos.x) / 2;
      const midY = (fromPos.y + toPos.y) / 2;
      
      // Background for text
      const weightText = `$${edge.price?.toFixed(0) || 0}`;
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
      ctx.strokeStyle = isRoutePath ? "#f4bc3b" : "#94a3b8";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        midX - textWidth / 2 - 4,
        midY - textHeight / 2 - 2,
        textWidth + 8,
        textHeight + 4
      );
      
      // Draw text
      ctx.fillStyle = isRoutePath ? "#2d1b04" : "#475569";
      ctx.fillText(weightText, midX, midY);
    });

    // Draw nodes
    airports.forEach(airport => {
      const pos = nodePositions[airport];
      if (!pos) return;

      const isSource = airport === src;
      const isDest = airport === dst;
      const isSelected = selectedNode === airport;

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
      
      if (isSource) {
        ctx.fillStyle = "#10b981"; // Green for source
      } else if (isDest) {
        ctx.fillStyle = "#3b82f6"; // Blue for destination
      } else if (isSelected) {
        ctx.fillStyle = "#f4bc3b"; // Yellow for selected
      } else {
        ctx.fillStyle = "#ffffff";
      }
      ctx.fill();

      // Border
      ctx.strokeStyle = isSource ? "#059669" : isDest ? "#2563eb" : "#1d3f3b";
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(airport, pos.x, pos.y);
    });

    // Add click handler to canvas
    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      // Check which node was clicked
      for (const airport of airports) {
        const pos = nodePositions[airport];
        if (!pos) continue;
        const distance = Math.sqrt(
          Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2)
        );
        if (distance <= nodeRadius) {
          setSelectedNode(airport === selectedNode ? null : airport);
          break;
        }
      }
    };

    canvas.addEventListener("click", handleCanvasClick);
    return () => {
      canvas.removeEventListener("click", handleCanvasClick);
    };
  };


  const isInRoutePath = (from, to, src, dst, edges) => {
    // Only highlight direct path edges (source → destination)
    return from === src && to === dst;
  };

  if (loading) {
    return (
      <div className="visualizer-container">
        <div className="visualizer-loading">
          <div className="loading-spinner">⏳</div>
          <p>Loading graph visualization...</p>
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
          <button onClick={loadData} className="btn-retry">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-network-visualizer">
      <div className="gnv-header">
        <h4>Graph Network Visualization</h4>
        {source && dest ? (
          <p className="gnv-route-info">
            Showing subgraph for route: <strong>{source} → {dest}</strong>
          </p>
        ) : (
          <p className="gnv-route-info">
            Select source and destination airports to visualize the route network
          </p>
        )}
      </div>

      {source && dest && (
        <div className="gnv-canvas-wrapper">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            className="gnv-canvas"
          />
        </div>
      )}

      {/* Overall Network Stats - Show when no airports selected */}
      {!source && !dest && stats && (
        <div className="gnv-stats-quick">
          <div className="gnv-stat-quick">
            <span className="gnv-stat-label">Airports in Network</span>
            <span className="gnv-stat-value">{stats.vertices}</span>
          </div>
          <div className="gnv-stat-quick">
            <span className="gnv-stat-label">Total Flights</span>
            <span className="gnv-stat-value">{stats.edges}</span>
          </div>
          <div className="gnv-stat-quick">
            <span className="gnv-stat-label">Network Density</span>
            <span className="gnv-stat-value">{(stats.density * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}

      {source && dest && routeAnalysis && (
        <div className="gnv-explanation">
          <div className="gnv-explanation-section">
            <h5>📊 What You're Seeing</h5>
            <div className="gnv-explanation-content">
              <p>
                <strong>Subgraph Visualization:</strong> This shows the airports and flights 
                involved in finding routes from <strong>{source}</strong> to <strong>{dest}</strong>.
              </p>
              <ul>
                <li>
                  <span className="gnv-legend-color" style={{ backgroundColor: "#10b981" }}></span>
                  <strong>Green nodes</strong> = Source airport ({source})
                </li>
                <li>
                  <span className="gnv-legend-color" style={{ backgroundColor: "#3b82f6" }}></span>
                  <strong>Blue nodes</strong> = Destination airport ({dest})
                </li>
                <li>
                  <span className="gnv-legend-color" style={{ backgroundColor: "#f4bc3b" }}></span>
                  <strong>Yellow edges</strong> = Direct path connections
                </li>
                <li>
                  <span className="gnv-legend-color" style={{ backgroundColor: "#cbd5e1" }}></span>
                  <strong>Gray edges</strong> = Alternative connections
                </li>
              </ul>
            </div>
          </div>


          {routeAnalysis && (
            <div className="gnv-stats-quick">
              <div className="gnv-stat-quick">
                <span className="gnv-stat-label">Airports in Subgraph</span>
                <span className="gnv-stat-value">{routeAnalysis.subgraph.vertices_count}</span>
              </div>
              <div className="gnv-stat-quick">
                <span className="gnv-stat-label">Available Flights</span>
                <span className="gnv-stat-value">{routeAnalysis.subgraph.edges_count}</span>
              </div>
              <div className="gnv-stat-quick">
                <span className="gnv-stat-label">Path Options</span>
                <span className="gnv-stat-value">{routeAnalysis.path_stats.total_paths}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

