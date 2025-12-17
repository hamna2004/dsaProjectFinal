import React, { useEffect, useState } from "react";
import { fetchFlights } from "../services/api";
import "../styles/flights.css";

export default function FlightsPage() {
  const [flights, setFlights] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("price");
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    loadFlights();
  }, []);

  // Reload flights when sort or search changes (backend handles both)
  useEffect(() => {
    // Debounce search to avoid too many API calls
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      loadFlights();
    }, 300); // Wait 300ms after user stops typing

    setSearchTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [sortKey, search]);

  const loadFlights = async () => {
    setLoading(true);
    try {
      // Fetch flights with sort and search parameters
      // Backend uses Merge Sort for sorting and Linear Search for searching
      const data = await fetchFlights(null, null, sortKey, search || null);
      setFlights(data);
    } catch (error) {
      console.error("Error loading flights:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle sort change - triggers backend sorting
  const handleSort = (key) => {
    setSortKey(key);
    // Flights will be reloaded via useEffect with new sortKey
  };

  // Handle search change - triggers backend Linear Search
  const handleSearchChange = (value) => {
    setSearch(value);
    // Flights will be reloaded via useEffect with new search query
  };

  return (
    <div className="flights-page">
      <h2>All Flights</h2>

      {/* SEARCH + SORT PANEL */}
      <div className="flights-controls">
        <input
          type="text"
          placeholder="Search flights, airline, airport... (Linear Search)"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        <select value={sortKey} onChange={(e) => handleSort(e.target.value)}>
          <option value="price">Sort by Price</option>
          <option value="duration">Sort by Duration</option>
          <option value="airline">Sort by Airline</option>
        </select>
      </div>

      {/* FLIGHTS TABLE */}
      <table className="flights-table">
        <thead>
          <tr>
            <th>Flight No</th>
            <th>Airline</th>
            <th>From</th>
            <th>To</th>
            <th>Duration (min)</th>
            <th>Price ($)</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                Loading flights... (Searching using Linear Search, Sorting using Merge Sort)
              </td>
            </tr>
          ) : flights.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                No flights found
              </td>
            </tr>
          ) : (
            flights.map((f) => (
              <tr key={f.id}>
                <td>{f.flight_no}</td>
                <td>{f.airline}</td>
                <td>{f.source_airport.code}</td>
                <td>{f.dest_airport.code}</td>
                <td>{f.duration || "—"}</td>
                <td>{f.price ? `$${f.price}` : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

    </div>
  );
}
