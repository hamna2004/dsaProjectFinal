import React, { useEffect, useState } from "react";
import { fetchFlights } from "../services/api";
import "../styles/flights.css";

export default function FlightsPage() {
  const [flights, setFlights] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("price");
  const [sortedFlights, setSortedFlights] = useState([]);

  useEffect(() => {
    loadFlights();
  }, []);

  const loadFlights = async () => {
    const data = await fetchFlights();
    setFlights(data);
    setSortedFlights(data);
  };

  // Search filter
  useEffect(() => {
    let filtered = flights.filter(f =>
      f.flight_no.toLowerCase().includes(search.toLowerCase()) ||
      f.airline.toLowerCase().includes(search.toLowerCase()) ||
      f.source_airport.code.toLowerCase().includes(search.toLowerCase()) ||
      f.dest_airport.code.toLowerCase().includes(search.toLowerCase())
    );
    setSortedFlights(filtered);
  }, [search, flights]);

  // Sorting logic
  const handleSort = (key) => {
    setSortKey(key);

    const sorted = [...sortedFlights].sort((a, b) => {
      if (key === "price") return (a.price || 0) - (b.price || 0);
      if (key === "duration") return (a.duration || 0) - (b.duration || 0);
      if (key === "airline") return a.airline.localeCompare(b.airline);
    });

    setSortedFlights(sorted);
  };

  return (
    <div className="flights-page">
      <h2>All Flights</h2>

      {/* SEARCH + SORT PANEL */}
      <div className="flights-controls">
        <input
          type="text"
          placeholder="Search flights, airline, airport..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
          {sortedFlights.map((f) => (
            <tr key={f.id}>
              <td>{f.flight_no}</td>
              <td>{f.airline}</td>
              <td>{f.source_airport.code}</td>
              <td>{f.dest_airport.code}</td>
              <td>{f.duration || "—"}</td>
              <td>{f.price ? `$${f.price}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}
