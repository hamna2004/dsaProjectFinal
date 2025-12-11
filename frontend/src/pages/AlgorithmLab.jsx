import React, { useState } from "react";
import { Link } from "react-router-dom";
import DataStructuresSection from "../components/sections/DataStructuresSection";
import GraphAlgorithmsSection from "../components/sections/GraphAlgorithmsSection";
import AdvancedAlgorithmsSection from "../components/sections/AdvancedAlgorithmsSection";
import "../styles/algorithm-lab.css";

export default function AlgorithmLab() {
  const [activeSection, setActiveSection] = useState("data-structures");

  return (
    <div className="algorithm-lab">
      {/* Back to Home Button */}
      <div className="lab-back-button-container">
        <Link to="/" className="lab-back-button">
          ← Back to Home
        </Link>
      </div>

      {/* Hero Section */}
      <div className="lab-hero">
        <div className="lab-hero-content">
          <h1>🧪 Algorithm Laboratory</h1>
          <p className="lab-hero-subtitle">
            Explore data structures and algorithms in action
          </p>
          <p className="lab-hero-description">
            Visualize graph algorithms, data structures, and advanced pathfinding
            techniques used in flight route planning
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="lab-nav-tabs">
        <button
          className={`lab-tab ${activeSection === "data-structures" ? "active" : ""}`}
          onClick={() => setActiveSection("data-structures")}
        >
          🧭 Dijkstra's Algorithm Visualization
        </button>
        <button
          className={`lab-tab ${activeSection === "graph-algorithms" ? "active" : ""}`}
          onClick={() => setActiveSection("graph-algorithms")}
        >
          🌲 Minimum Spanning Tree
        </button>
        <button
          className={`lab-tab ${activeSection === "advanced" ? "active" : ""}`}
          onClick={() => setActiveSection("advanced")}
        >
          ⚖️ Optimal Route
        </button>
      </div>

      {/* Content Sections */}
      <div className="lab-content">
        {activeSection === "data-structures" && <DataStructuresSection />}
        {activeSection === "graph-algorithms" && <GraphAlgorithmsSection />}
        {activeSection === "advanced" && <AdvancedAlgorithmsSection />}
      </div>
    </div>
  );
}

