import React, { useState, useEffect } from "react";
import { fetchAirports } from "../../services/api";
import AirportDropdown from "../AirportDropDown.jsx";
import AdjacencyListVisualizer from "../visualizers/AdjacencyListVisualizer";
import AdjacencyMatrixVisualizer from "../visualizers/AdjacencyMatrixVisualizer";
import GraphNetworkVisualizer from "../visualizers/GraphNetworkVisualizer";

export default function GraphAnalysisSection() {
  const [airports, setAirports] = useState([]);
  const [routeSource, setRouteSource] = useState("");
  const [routeDest, setRouteDest] = useState("");

  useEffect(() => {
    fetchAirports().then(setAirports);
  }, []);

  return (
    <div className="lab-section">
      <div className="section-header">
        <h2>📊 Graph Analysis</h2>
        <p>Visualize the flight network structure and understand graph theory concepts</p>
      </div>

      <div className="section-grid">
        {/* Graph Network Visualization Card */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>🌐 Graph Network Visualization</h3>
            <p>Interactive visualization of the flight network graph structure</p>
          </div>
          
          {/* Route Selector with Dropdowns */}
          <div className="gnv-route-selector">
            <div className="gnv-selector-group">
              <label>Source Airport:</label>
              <AirportDropdown
                airports={airports}
                value={routeSource}
                onChange={setRouteSource}
              />
            </div>
            <div className="gnv-selector-group">
              <label>Destination Airport:</label>
              <AirportDropdown
                airports={airports}
                value={routeDest}
                onChange={setRouteDest}
              />
            </div>
            <button
              onClick={() => {
                setRouteSource("");
                setRouteDest("");
              }}
              className="gnv-clear-btn"
            >
              Clear
            </button>
          </div>

          <GraphNetworkVisualizer source={routeSource || null} dest={routeDest || null} />
        </div>

        {/* Adjacency List Card - Wider */}
        <div className="lab-card lab-card-medium">
          <div className="card-header">
            <h3>📋 Adjacency List</h3>
            <p>Graph representation as adjacency lists</p>
          </div>
          <AdjacencyListVisualizer />
        </div>

        {/* Adjacency Matrix Card - Wider */}
        <div className="lab-card lab-card-medium">
          <div className="card-header">
            <h3>🔲 Adjacency Matrix</h3>
            <p>Graph representation as adjacency matrix</p>
          </div>
          <AdjacencyMatrixVisualizer />
        </div>
      </div>
    </div>
  );
}

