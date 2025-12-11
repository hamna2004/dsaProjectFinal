import React from "react";
import DijkstraGraphVisualizer from "../visualizers/DijkstraGraphVisualizer";
import PriorityQueueTreeVisualizer from "../visualizers/PriorityQueueTreeVisualizer";
import AlgorithmComparisonVisualizer from "../visualizers/AlgorithmComparisonVisualizer";

export default function DataStructuresSection() {
  return (
    <div className="lab-section">
      <div className="section-header">
        <h2>🧭 Dijkstra's Algorithm Visualization</h2>
        <p>Visualize how Dijkstra's algorithm works in pathfinding</p>
      </div>

      <div className="section-grid">
        {/* Dijkstra Graph Visualization Card - Full Width */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>🧭 Dijkstra's Algorithm - Graph Visualization</h3>
            <p>See how Dijkstra's algorithm traverses the graph to find optimal paths</p>
          </div>
          <DijkstraGraphVisualizer />
        </div>

        {/* Priority Queue Tree Card - Full Width */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>🌳 Priority Queue (Heap Tree)</h3>
            <p>Min-heap structure used in Dijkstra's algorithm</p>
          </div>
          <PriorityQueueTreeVisualizer />
        </div>

        {/* Algorithm Comparison Card - Full Width */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>⚡ Performance Comparison</h3>
            <p>Compare Array-based vs Heap-based Dijkstra</p>
          </div>
          <AlgorithmComparisonVisualizer />
        </div>
      </div>
    </div>
  );
}

