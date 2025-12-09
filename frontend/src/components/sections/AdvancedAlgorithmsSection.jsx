import React from "react";
import ParetoOptimalRouteVisualizer from "../visualizers/ParetoOptimalRouteVisualizer";

export default function AdvancedAlgorithmsSection() {
  return (
    <div className="lab-section">
      <div className="section-header">
        <h2>⚖️ Optimal Route</h2>
        <p>Pareto optimal multi-criteria optimization: balance price, time, and distance</p>
      </div>

      <div className="section-grid">
        {/* Pareto Optimal Card - Full Width */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>⚖️ Pareto Optimal Routes</h3>
            <p>
              Find routes that are optimal across multiple criteria. A route is Pareto optimal 
              if no other route is better in ALL criteria (price, time, distance) simultaneously.
            </p>
          </div>
          <ParetoOptimalRouteVisualizer />
        </div>
      </div>
    </div>
  );
}

