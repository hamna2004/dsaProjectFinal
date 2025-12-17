import React, { useState, useEffect } from "react";
import { simulateDijkstra } from "../../services/api";
import { fetchAirports } from "../../services/api";
import AirportDropdown from "../AirportDropDown.jsx";
import DijkstraVisualizer from "../DijkstraVisualizer.jsx";

/**
 * Dijkstra Graph Visualizer Wrapper
 * 
 * This wrapper provides controls (source, dest, mode) and fetches simulation data
 * for the DijkstraVisualizer component to display graph visualization
 */
export default function DijkstraGraphVisualizer() {
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

  return (
    <div className="dijkstra-graph-visualizer-wrapper">
      {/* Controls */}
      <div className="dgv-controls">
        <div className="dgv-control-row">
          <div className="dgv-control-group">
            <label>Source:</label>
            <AirportDropdown
              airports={airports}
              value={source}
              onChange={setSource}
            />
          </div>
          <div className="dgv-control-group">
            <label>Destination:</label>
            <AirportDropdown
              airports={airports}
              value={dest}
              onChange={setDest}
            />
          </div>
          <div className="dgv-control-group">
            <label>Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="dgv-mode-select"
            >
              <option value="cheapest">Cheapest</option>
              <option value="fastest">Fastest</option>
            </select>
          </div>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="dgv-simulate-btn"
          >
            {loading ? "Simulating..." : "Simulate"}
          </button>
        </div>
      </div>

      {error && (
        <div className="dgv-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading && (
        <div className="dgv-loading">
          <div className="loading-spinner"></div>
          <p>Running Dijkstra's algorithm...</p>
        </div>
      )}

      {!loading && !error && simulationData && (
        <>
          {/* Playback Controls */}
          <div className="dgv-playback-controls">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="dgv-control-btn dgv-play-btn"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={() => setCurrentStep(0)}
              className="dgv-control-btn"
              disabled={currentStep === 0}
            >
              ⏮ First
            </button>
            <button
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              className="dgv-control-btn"
              disabled={currentStep === 0}
            >
              ⏪ Prev
            </button>
            <span className="dgv-step-info">
              Step {currentStep + 1} / {simulationData.states.length}
            </span>
            <button
              onClick={() =>
                setCurrentStep((prev) =>
                  Math.min(simulationData.states.length - 1, prev + 1)
                )
              }
              className="dgv-control-btn"
              disabled={currentStep >= simulationData.states.length - 1}
            >
              Next ⏩
            </button>
            <button
              onClick={() => setCurrentStep(simulationData.states.length - 1)}
              className="dgv-control-btn"
              disabled={currentStep >= simulationData.states.length - 1}
            >
              Last ⏭
            </button>
          </div>

          <DijkstraVisualizer
            states={simulationData.states}
            source={source}
            optimization={mode}
            autoplay={isPlaying}
            route={simulationData.route}
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
          />
        </>
      )}

      {!loading && !error && !simulationData && (
        <div className="dgv-placeholder">
          <div className="placeholder-icon">🧭</div>
          <h4>Dijkstra's Algorithm - Graph Visualization</h4>
          <p>Select source and destination airports, then click "Simulate" to visualize how Dijkstra's algorithm finds the optimal path on the graph</p>
        </div>
      )}
    </div>
  );
}

