import React, { useState, useEffect, useRef } from "react";
import { findOptimalRoute } from "../../services/api";
import { fetchAirports } from "../../services/api";
import AirportDropdown from "../AirportDropDown";
import "../../styles/pareto-optimal-visualizer.css";

export default function ParetoOptimalRouteVisualizer() {
  const [airports, setAirports] = useState([]);
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [animationStep, setAnimationStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef(null);

  // Load airports
  useEffect(() => {
    fetchAirports().then(setAirports);
  }, []);

  // Animation effect
  useEffect(() => {
    if (!isPlaying || !results) return;

    const interval = setInterval(() => {
      setAnimationStep((prev) => {
        const maxStep = results.candidates ? results.candidates.length + 2 : 0;
        if (prev >= maxStep) {
          setIsPlaying(false);
          return maxStep;
        }
        return prev + 1;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, results]);

  const handleSearch = async () => {
    if (!source || !dest) {
      setError("Please select both source and destination airports");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setAnimationStep(0);
    setIsPlaying(false);

    try {
      const result = await findOptimalRoute(source, dest, "pareto");
      
      if (!result.success) {
        setError(result.error || "No Pareto optimal routes found");
        setLoading(false);
        return;
      }

      // Simulate step-by-step process for visualization
      const candidates = [];
      
      // Get individual algorithm results to show the process
      const [cheapest, fastest, shortest] = await Promise.all([
        findOptimalRoute(source, dest, "cheapest").catch(() => null),
        findOptimalRoute(source, dest, "fastest").catch(() => null),
        findOptimalRoute(source, dest, "shortest").catch(() => null),
      ]);

      // Helper function to create route key for comparison
      const getRouteKey = (route) => {
        if (!route) return null;
        const path = route.path || (route.legs ? route.legs.map(l => l.from).concat([route.legs[route.legs.length - 1]?.to]) : []);
        return JSON.stringify(path);
      };

      if (cheapest?.success && cheapest.route) {
        candidates.push({ ...cheapest.route, algorithm: "cheapest", label: "Cheapest Route" });
      }
      if (fastest?.success && fastest.route) {
        candidates.push({ ...fastest.route, algorithm: "fastest", label: "Fastest Route" });
      }
      if (shortest?.success && shortest.route) {
        candidates.push({ ...shortest.route, algorithm: "shortest", label: "Shortest Route" });
      }

      // Map Pareto routes to their algorithm types for proper labeling
      const paretoRoutesWithLabels = (result.routes || []).map(route => {
        const routeKey = getRouteKey(route);
        
        // Try to match with candidate routes to get the algorithm label
        const matchingCandidate = candidates.find(c => getRouteKey(c) === routeKey);
        if (matchingCandidate) {
          return { ...route, algorithm: matchingCandidate.algorithm, label: matchingCandidate.label };
        }
        
        // If no match, try to determine from the route characteristics
        // (This is a fallback - ideally all routes should match candidates)
        return { ...route, algorithm: "pareto", label: "Pareto Optimal" };
      });

      // Get all candidates from backend (including dominated ones)
      const allCandidates = result.all_candidates || result.routes || [];
      
      setResults({
        paretoRoutes: paretoRoutesWithLabels,
        candidates: candidates, // Algorithm-specific candidates for step-by-step
        allCandidates: allCandidates, // ALL routes from backend (for visualization)
        paretoCount: result.pareto_count || 0,
        totalCandidates: result.total_candidates || allCandidates.length,
      });

      // Start animation
      setTimeout(() => setIsPlaying(true), 500);
    } catch (err) {
      setError(err.message || "Failed to find optimal routes");
    } finally {
      setLoading(false);
    }
  };

  const resetAnimation = () => {
    setAnimationStep(0);
    setIsPlaying(false);
  };

  const nextStep = () => {
    if (results) {
      const maxStep = results.candidates ? results.candidates.length + 2 : 0;
      setAnimationStep((prev) => Math.min(prev + 1, maxStep));
    }
  };

  const prevStep = () => {
    setAnimationStep((prev) => Math.max(prev - 1, 0));
  };

  // Draw comparison chart
  useEffect(() => {
    if (!results || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    // Set high DPI for better quality
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Enable text rendering quality
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Helper function to get route path for comparison
    const getRoutePath = (route) => {
      if (route.path && Array.isArray(route.path)) {
        return JSON.stringify(route.path);
      }
      if (route.legs && Array.isArray(route.legs) && route.legs.length > 0) {
        const path = route.legs.map(l => l.from).concat([route.legs[route.legs.length - 1]?.to]);
        return JSON.stringify(path);
      }
      return null;
    };

    // Match Pareto routes with candidates to preserve labels
    const paretoRoutesWithLabels = (results.paretoRoutes || []).map(route => {
      const routePath = getRoutePath(route);
      if (!routePath) return route;
      
      // Try to find matching candidate
      const matchingCandidate = (results.candidates || []).find(c => {
        const candidatePath = getRoutePath(c);
        return candidatePath === routePath;
      });
      
      if (matchingCandidate) {
        return { ...route, algorithm: matchingCandidate.algorithm, label: matchingCandidate.label };
      }
      
      return route;
    });

    // Get all routes - use allCandidates if available (includes dominated routes for visualization)
    // Prioritize allCandidates as it contains ALL routes from backend (including dominated ones)
    const allRoutes = results.allCandidates && results.allCandidates.length > 0
      ? results.allCandidates 
      : [...(results.candidates || []), ...paretoRoutesWithLabels];
    
    if (allRoutes.length === 0) return;
    
    // Calculate max step for visibility checks
    const maxStep = (results.candidates?.length || 0) + 2;

    // Normalize values for visualization
    const prices = allRoutes.map(r => r.totalPriceUSD || r.total_cost || 0).filter(p => p > 0);
    const times = allRoutes.map(r => r.totalDurationMin || r.total_duration || 0).filter(t => t > 0);
    const distances = allRoutes.map(r => r.totalDistanceKM || r.total_distance || 0).filter(d => d > 0);

    // Add padding to ranges so routes near edges are visible
    const minPrice = Math.min(...prices, 0);
    const minTime = Math.min(...times, 0);
    const maxPrice = Math.max(...prices, 1);
    const maxTime = Math.max(...times, 1);
    const maxDist = Math.max(...distances, 1);
    
    // Add 10% padding to ranges
    const priceRange = maxPrice - minPrice;
    const timeRange = maxTime - minTime;
    const paddedMinPrice = Math.max(0, minPrice - priceRange * 0.1);
    const paddedMaxPrice = maxPrice + priceRange * 0.1;
    const paddedMinTime = Math.max(0, minTime - timeRange * 0.1);
    const paddedMaxTime = maxTime + timeRange * 0.1;

    const padding = 80;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Draw axes with better quality
    ctx.strokeStyle = "#5c6b70";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw axis labels with better positioning
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Price (USD)", width / 2, height - padding + 10);
    
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Time (hours)", 0, 0);
    ctx.restore();

    // Draw grid with axis values
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#5c6b70";
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    for (let i = 0; i <= 5; i++) {
      const x = padding + (chartWidth / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();

      const y = height - padding - (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      // X-axis labels (use padded range)
      const priceValue = paddedMinPrice + ((paddedMaxPrice - paddedMinPrice) / 5) * i;
      ctx.fillText(`$${priceValue.toFixed(0)}`, x, height - padding + 5);
      
      // Y-axis labels (use padded range)
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const timeValue = paddedMinTime + ((paddedMaxTime - paddedMinTime) / 5) * i;
      ctx.fillText(`${(timeValue / 60).toFixed(1)}h`, padding - 8, y);
      ctx.textAlign = "center";
    }
    
    // Draw routes
    allRoutes.forEach((route, idx) => {
      const price = route.totalPriceUSD || route.total_cost || 0;
      const time = route.totalDurationMin || route.total_duration || 0;

      // Use padded ranges for positioning
      const normalizedPrice = (price - paddedMinPrice) / (paddedMaxPrice - paddedMinPrice);
      const normalizedTime = (time - paddedMinTime) / (paddedMaxTime - paddedMinTime);
      const x = padding + normalizedPrice * chartWidth;
      const y = height - padding - normalizedTime * chartHeight;

      const routePath = getRoutePath(route);
      
      const isPareto = results.paretoRoutes && results.paretoRoutes.some(pr => {
        const prPath = getRoutePath(pr);
        return prPath && routePath && prPath === routePath;
      });
      const isCandidate = results.candidates && results.candidates.some(c => {
        const cPath = getRoutePath(c);
        return cPath && routePath && cPath === routePath;
      });
      
      // Show all routes in final step, or show candidates progressively during animation
      const isVisible = 
        animationStep >= maxStep || // Final step: show ALL routes (candidates + Pareto)
        (isPareto && animationStep >= (results.candidates?.length || 0) + 1) || // Show Pareto routes in step 2+
        (isCandidate && animationStep > idx); // Show candidates progressively

      if (!isVisible) {
        return;
      }
      
      // Check if route is within visible bounds (skip if way outside)
      if (x < padding - 50 || x > width - padding + 50 || y < padding - 50 || y > height - padding + 50) {
        return; // Skip routes way outside bounds
      }

      // Draw point with better quality - ALWAYS draw if visible
      ctx.beginPath();
      const radius = isPareto ? 8 : 8; // Same size for both, color distinguishes them
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      
      // Set colors - make sure non-Pareto routes are visible
      if (isPareto) {
        ctx.fillStyle = "#f4bc3b"; // Gold for Pareto
        ctx.shadowColor = "rgba(244, 188, 59, 0.5)";
        ctx.shadowBlur = 6;
      } else if (isCandidate) {
        ctx.fillStyle = "#3b82f6"; // Blue for candidates
        ctx.shadowColor = "rgba(59, 130, 246, 0.3)";
        ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = "#94a3b8"; // Gray for other routes
        ctx.shadowBlur = 0;
      }
      
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow
      
      // Draw border
      ctx.strokeStyle = isPareto ? "#d4a017" : "#fff";
      ctx.lineWidth = isPareto ? 2 : 2;
      ctx.stroke();
    });

    // Highlight Pareto front (only in final step, and only if multiple Pareto routes)
    if (animationStep >= maxStep && results.paretoRoutes && results.paretoRoutes.length > 1) {
      const paretoPoints = results.paretoRoutes.map(route => {
        const price = route.totalPriceUSD || route.total_cost || 0;
        const time = route.totalDurationMin || route.total_duration || 0;
        const normalizedPrice = (price - paddedMinPrice) / (paddedMaxPrice - paddedMinPrice);
        const normalizedTime = (time - paddedMinTime) / (paddedMaxTime - paddedMinTime);
        return {
          x: padding + normalizedPrice * chartWidth,
          y: height - padding - normalizedTime * chartHeight,
        };
      }).sort((a, b) => a.x - b.x);

      // Draw Pareto front line (connecting optimal points)
      ctx.strokeStyle = "#f4bc3b";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.shadowColor = "rgba(244, 188, 59, 0.4)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(paretoPoints[0].x, paretoPoints[0].y);
      for (let i = 1; i < paretoPoints.length; i++) {
        ctx.lineTo(paretoPoints[i].x, paretoPoints[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }
  }, [results, animationStep]);

  return (
    <div className="pareto-optimal-visualizer">
      {/* Controls */}
      <div className="pov-controls">
        <div className="pov-control-row">
          <div className="pov-control-group">
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
            <button
              className="pov-search-btn"
              onClick={handleSearch}
              disabled={loading || !source || !dest}
            >
              {loading ? "Finding Routes..." : "Find Optimal Routes"}
            </button>
          </div>
        </div>

        {results && (
          <div className="pov-playback-controls">
            <button
              className="pov-control-btn"
              onClick={prevStep}
              disabled={animationStep === 0}
            >
              ← Prev
            </button>
            <button
              className="pov-control-btn pov-play-btn"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              className="pov-control-btn"
              onClick={nextStep}
              disabled={animationStep >= (results.candidates?.length || 0) + 2}
            >
              Next →
            </button>
            <button
              className="pov-control-btn"
              onClick={resetAnimation}
            >
              ↺ Reset
            </button>
            <div className="pov-step-info">
              Step {animationStep} / {(results.candidates?.length || 0) + 2}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="pov-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading && (
        <div className="pov-loading">
          <div className="pov-spinner"></div>
          <p>Finding optimal routes...</p>
        </div>
      )}

      {results && (
        <div className="pov-results">
          {/* Stats Header */}
          <div className="pov-stats-header">
            <div className="pov-stat-card">
              <div className="pov-stat-label">Total Candidates</div>
              <div className="pov-stat-value">{results.totalCandidates}</div>
            </div>
            <div className="pov-stat-card">
              <div className="pov-stat-label">Pareto Optimal</div>
              <div className="pov-stat-value highlight">{results.paretoCount}</div>
            </div>
            <div className="pov-stat-card">
              <div className="pov-stat-label">Filtered Out</div>
              <div className="pov-stat-value">
                {results.totalCandidates - results.paretoCount}
              </div>
            </div>
          </div>

          {/* Main Visualization Area */}
          <div className="pov-main-layout">
            {/* Left: Comparison Chart */}
            <div className="pov-chart-section">
              <div className="pov-chart-header">
                <h4>Price vs Time Comparison</h4>
                <div className="pov-legend">
                  <div className="pov-legend-item">
                    <span className="pov-legend-dot candidate"></span>
                    Candidate Routes
                  </div>
                  <div className="pov-legend-item">
                    <span className="pov-legend-dot pareto"></span>
                    Pareto Optimal
                  </div>
                  <div className="pov-legend-item">
                    <span className="pov-legend-dot other"></span>
                    Other Routes
                  </div>
                </div>
              </div>
              <canvas
                ref={canvasRef}
                className="pov-canvas"
                style={{ width: '100%', height: '400px' }}
              />
            </div>

            {/* Right: Step-by-Step Process */}
            <div className="pov-process-section">
              <h4>Algorithm Process</h4>
              <div className="pov-process-steps">
                {/* Step 1: Find candidates */}
                <div className={`pov-process-step ${animationStep > 0 ? 'active' : ''}`}>
                  <div className="pov-step-number">1</div>
                  <div className="pov-step-content">
                    <h5>Find Candidate Routes</h5>
                    <p>Run cheapest, fastest, and shortest algorithms</p>
                    {animationStep > 0 && results.candidates && (
                      <div className="pov-candidates-list">
                        {results.candidates.map((candidate, idx) => (
                          <div
                            key={idx}
                            className={`pov-candidate-item ${animationStep > idx + 1 ? 'visible' : ''}`}
                          >
                            <span className="pov-candidate-algo">{candidate.label}</span>
                            <span className="pov-candidate-metrics">
                              ${(candidate.totalPriceUSD || candidate.total_cost || 0).toFixed(2)} • 
                              {((candidate.totalDurationMin || candidate.total_duration || 0) / 60).toFixed(1)}h • 
                              {(candidate.totalDistanceKM || candidate.total_distance || 0).toFixed(0)}km
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Check dominance */}
                <div className={`pov-process-step ${animationStep >= (results.candidates?.length || 0) + 1 ? 'active' : ''}`}>
                  <div className="pov-step-number">2</div>
                  <div className="pov-step-content">
                    <h5>Check Dominance</h5>
                    <p>Remove routes that are dominated by others</p>
                    {animationStep >= (results.candidates?.length || 0) + 1 && (
                      <div className="pov-dominance-explanation">
                        <p>
                          A route is <strong>dominated</strong> if another route is better or equal
                          in ALL criteria (price, time, distance) AND strictly better in at least one.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3: Pareto front */}
                <div className={`pov-process-step ${animationStep >= (results.candidates?.length || 0) + 2 ? 'active' : ''}`}>
                  <div className="pov-step-number">3</div>
                  <div className="pov-step-content">
                    <h5>Pareto Optimal Routes</h5>
                    <p>Final set of non-dominated routes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pareto Routes List */}
          {animationStep >= (results.candidates?.length || 0) + 2 && (
            <div className="pov-routes-section">
              <h4>Optimal Routes ({results.paretoCount})</h4>
              <div className="pov-routes-grid">
                {results.paretoRoutes.map((route, idx) => (
                  <div key={idx} className="pov-route-card">
                    <div className="pov-route-header">
                      <span className="pov-route-number">Route {idx + 1}</span>
                      <span className="pov-route-badge">Pareto Optimal</span>
                    </div>
                    <div className="pov-route-path">
                      {route.path && route.path.length > 0 ? (
                        route.path.map((airport, i) => (
                          <React.Fragment key={i}>
                            <span className="pov-airport">{airport}</span>
                            {i < route.path.length - 1 && (
                              <span className="pov-arrow">→</span>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <span>No path data</span>
                      )}
                    </div>
                    <div className="pov-route-metrics">
                      <div className="pov-metric">
                        <span className="pov-metric-label">Price</span>
                        <span className="pov-metric-value">
                          ${(route.totalPriceUSD || route.total_cost || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="pov-metric">
                        <span className="pov-metric-label">Time</span>
                        <span className="pov-metric-value">
                          {((route.totalDurationMin || route.total_duration || 0) / 60).toFixed(1)}h
                        </span>
                      </div>
                      <div className="pov-metric">
                        <span className="pov-metric-label">Distance</span>
                        <span className="pov-metric-value">
                          {(route.totalDistanceKM || route.total_distance || 0).toFixed(0)}km
                        </span>
                      </div>
                    </div>
                    {route.legs && route.legs.length > 0 && (
                      <div className="pov-route-legs">
                        <details>
                          <summary>View Legs ({route.legs.length})</summary>
                          <div className="pov-legs-list">
                            {route.legs.map((leg, legIdx) => (
                              <div key={legIdx} className="pov-leg-item">
                                <span>{leg.from} → {leg.to}</span>
                                <span>
                                  ${(leg.priceUSD || leg.cost || 0).toFixed(2)} • 
                                  {((leg.durationMin || leg.duration || 0) / 60).toFixed(1)}h
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!results && !loading && !error && (
        <div className="pov-empty">
          <div className="pov-empty-icon">⚖️</div>
          <h4>Pareto Optimal Route Finder</h4>
          <p>
            Find routes that are optimal across multiple criteria (price, time, distance).
            No single route dominates all others in every aspect.
          </p>
        </div>
      )}
    </div>
  );
}

