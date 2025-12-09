import React from "react";
import PriorityQueueTreeVisualizer from "../visualizers/PriorityQueueTreeVisualizer";
import ParentPointersVisualizer from "../visualizers/ParentPointersVisualizer";
import AlgorithmComparisonVisualizer from "../visualizers/AlgorithmComparisonVisualizer";

export default function DataStructuresSection() {
  return (
    <div className="lab-section">
      <div className="section-header">
        <h2>🔧 Data Structures</h2>
        <p>Visualize how data structures work in pathfinding algorithms</p>
      </div>

      <div className="section-grid">
        {/* Priority Queue Tree Card - Full Width */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>🌳 Priority Queue (Heap Tree)</h3>
            <p>Min-heap structure used in Dijkstra's algorithm</p>
          </div>
          <PriorityQueueTreeVisualizer />
        </div>

        {/* Parent Pointers Card - Full Width */}
        <div className="lab-card lab-card-wide">
          <div className="card-header">
            <h3>🔗 Parent Pointers</h3>
            <p>Path reconstruction using came_from map</p>
          </div>
          <ParentPointersVisualizer />
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

