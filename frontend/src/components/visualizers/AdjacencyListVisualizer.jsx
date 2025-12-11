import React, { useEffect, useState, useMemo } from "react";
import { fetchAdjacencyList } from "../../services/api";

/**
 * Adjacency List Visualizer Component
 * 
 * DSA CONCEPT: Adjacency List Representation
 * 
 * An adjacency list is a way to represent a graph where:
 * - Each vertex (airport) has a list of its neighbors (connected airports)
 * - Each edge (flight) stores additional information (weight, metadata)
 * 
 * Why use adjacency lists?
 * - Space efficient: O(V + E) where V = vertices, E = edges
 * - Fast neighbor iteration: O(degree(v)) to check all neighbors of vertex v
 * - Perfect for sparse graphs (few edges relative to possible edges)
 * 
 * In route planning:
 * - Dijkstra's algorithm uses adjacency lists to explore neighbors
 * - When finding cheapest route, it iterates through each airport's flight list
 * - Time complexity: O((V + E) log V) with priority queue
 * 
 * This visualizer shows the actual data structure used by pathfinding algorithms
 */
export default function AdjacencyListVisualizer() {
  const [adjacencyList, setAdjacencyList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAirport, setSelectedAirport] = useState("");
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Fetch adjacency list data on component mount
  useEffect(() => {
    loadAdjacencyList();
  }, []);

  const loadAdjacencyList = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdjacencyList();
      if (result.success) {
        setAdjacencyList(result.data);
      } else {
        setError(result.error || "Failed to load adjacency list");
      }
    } catch (err) {
      setError(err.message || "Failed to load adjacency list");
    } finally {
      setLoading(false);
    }
  };

  // Filter airports based on selected airport
  // DSA: Simple linear search O(n) where n = number of airports
  const filteredAirports = useMemo(() => {
    if (!adjacencyList) return [];
    
    const airports = Object.keys(adjacencyList);
    if (!selectedAirport) return airports;
    
    // If an airport is selected, show only that airport
    return airports.filter(airport => airport === selectedAirport);
  }, [adjacencyList, selectedAirport]);

  // Toggle expansion of a node (airport)
  const toggleNode = (airport) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(airport)) {
      newExpanded.delete(airport);
    } else {
      newExpanded.add(airport);
    }
    setExpandedNodes(newExpanded);
  };

  // Expand all nodes
  const expandAll = () => {
    if (!adjacencyList) return;
    setExpandedNodes(new Set(Object.keys(adjacencyList)));
  };

  // Collapse all nodes
  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  if (loading) {
    return (
      <div className="visualizer-container">
        <div className="visualizer-loading">
          <div className="loading-spinner">⏳</div>
          <p>Loading adjacency list...</p>
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
          <button onClick={loadAdjacencyList} className="btn-retry">Retry</button>
        </div>
      </div>
    );
  }

  if (!adjacencyList || Object.keys(adjacencyList).length === 0) {
    return (
      <div className="visualizer-container">
        <div className="visualizer-placeholder">
          <div className="placeholder-icon">📋</div>
          <h4>No Data Available</h4>
          <p>No flights found in the database</p>
        </div>
      </div>
    );
  }

  const totalAirports = Object.keys(adjacencyList).length;
  const totalFlights = Object.values(adjacencyList).reduce((sum, flights) => sum + flights.length, 0);
  const avgDegree = totalFlights / totalAirports;

  return (
    <div className="adj-list-visualizer">
      {/* Statistics Header */}
      <div className="adj-list-stats">
        <div className="adj-stat-item">
          <span className="adj-stat-label">Airports (Vertices)</span>
          <span className="adj-stat-value">{totalAirports}</span>
        </div>
        <div className="adj-stat-item">
          <span className="adj-stat-label">Flights (Edges)</span>
          <span className="adj-stat-value">{totalFlights}</span>
        </div>
        <div className="adj-stat-item">
          <span className="adj-stat-label">Avg Degree</span>
          <span className="adj-stat-value">{avgDegree.toFixed(1)}</span>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="adj-list-controls">
        <select
          value={selectedAirport}
          onChange={(e) => setSelectedAirport(e.target.value)}
          className="adj-list-search"
        >
          <option value="">All Airports</option>
          {Object.keys(adjacencyList || {}).sort().map((airport) => (
            <option key={airport} value={airport}>
              {airport}
            </option>
          ))}
        </select>
        <div className="adj-list-buttons">
          <button onClick={expandAll} className="adj-list-btn">
            Expand All
          </button>
          <button onClick={collapseAll} className="adj-list-btn">
            Collapse All
          </button>
          <button onClick={loadAdjacencyList} className="adj-list-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Adjacency List Display */}
      <div className="adj-list-container">
        {filteredAirports.length === 0 ? (
          <div className="adj-list-empty">
            <p>No airports found</p>
          </div>
        ) : (
          filteredAirports.map((airport) => {
            const flights = adjacencyList[airport] || [];
            const isExpanded = expandedNodes.has(airport);
            const degree = flights.length; // Number of outgoing edges

            return (
              <div key={airport} className="adj-list-node">
                {/* Node Header - Clickable to expand/collapse */}
                <div 
                  className={`adj-list-node-header ${isExpanded ? "expanded" : ""}`}
                  onClick={() => toggleNode(airport)}
                >
                  <span className="adj-list-node-icon">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <span className="adj-list-node-code">{airport}</span>
                  <span className="adj-list-node-degree">
                    {degree} {degree === 1 ? "flight" : "flights"}
                  </span>
                </div>

                {/* Node Content - List of neighbors (flights) */}
                {isExpanded && (
                  <div className="adj-list-node-content">
                    {flights.length === 0 ? (
                      <div className="adj-list-empty-flights">
                        No outgoing flights from {airport}
                      </div>
                    ) : (
                      flights.map((flight, idx) => (
                        <div key={idx} className="adj-list-edge">
                          {/* Edge visualization: airport → destination */}
                          <div className="adj-list-edge-main">
                            <span className="adj-list-edge-arrow">→</span>
                            <span className="adj-list-edge-dest">{flight.to}</span>
                          </div>
                          
                          {/* Edge metadata: flight details */}
                          <div className="adj-list-edge-details">
                            {flight.flight_no && (
                              <span className="adj-list-edge-info">
                                <strong>Flight:</strong> {flight.flight_no}
                              </span>
                            )}
                            <span className="adj-list-edge-info">
                              <strong>Price:</strong> ${flight.price?.toFixed(2) || "0.00"}
                            </span>
                            <span className="adj-list-edge-info">
                              <strong>Duration:</strong> {flight.duration || 0} min
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
