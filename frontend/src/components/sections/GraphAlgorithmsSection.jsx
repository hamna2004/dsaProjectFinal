import React from "react";
import MSTVisualizer from "../visualizers/MSTVisualizer";

export default function GraphAlgorithmsSection() {
  return (
    <div className="lab-section">
      <div className="section-header">
        <h2>🌲 Minimum Spanning Tree</h2>
        <p>Find the cheapest route using Prim's and Kruskal's algorithms</p>
      </div>

      <div className="section-grid">
        {/* MST Card */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>🌲 Minimum Spanning Tree</h3>
            <p>Visualize Prim's and Kruskal's algorithms to find the cheapest route between airports</p>
          </div>
          <MSTVisualizer />
        </div>
      </div>
    </div>
  );
}

