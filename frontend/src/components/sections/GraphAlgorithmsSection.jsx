import React from "react";
import MSTVisualizer from "../visualizers/MSTVisualizer";
import BFSTraversalVisualizer from "../visualizers/BFSTraversalVisualizer";
import ConnectivityCheckerVisualizer from "../visualizers/ConnectivityCheckerVisualizer";

export default function GraphAlgorithmsSection() {
  return (
    <div className="lab-section">
      <div className="section-header">
        <h2>🌳 Graph Algorithms</h2>
        <p>Classic graph algorithms applied to flight networks</p>
      </div>

      <div className="section-grid">
        {/* MST Card */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>🌲 Minimum Spanning Tree</h3>
            <p>Find the cheapest airline network using Kruskal's or Prim's algorithm</p>
          </div>
          <MSTVisualizer />
        </div>

        {/* BFS Traversal Card */}
        <div className="lab-card">
          <div className="card-header">
            <h3>🔍 BFS Traversal</h3>
            <p>Breadth-first search visualization</p>
          </div>
          <BFSTraversalVisualizer />
        </div>

        {/* Connectivity Checker Card */}
        <div className="lab-card">
          <div className="card-header">
            <h3>✅ Connectivity Checker</h3>
            <p>Check if airports are reachable from each other</p>
          </div>
          <ConnectivityCheckerVisualizer />
        </div>
      </div>
    </div>
  );
}

