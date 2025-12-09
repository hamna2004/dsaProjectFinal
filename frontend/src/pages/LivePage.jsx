import React, { useEffect, useState } from "react";
import LiveMap from "../components/LiveMap";
import "./LivePage.css";


export default function LivePage() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    async function loadFlights() {
      try {
        const res = await fetch("https://opensky-network.org/api/states/all");
        const data = await res.json();

        setFlights(data.states || []);
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Failed to load:", err);
      }

      setLoading(false);
    }

    loadFlights(); // load once

    const interval = setInterval(loadFlights, 5000); // auto refresh

    return () => clearInterval(interval);
  }, []);

  return (
<div className="live-page">
      <h2 style={{ fontSize: "28px", marginBottom: "10px" }}>Flight Tracker</h2>
      <p style={{ color: "#94a3b8" }}>Live air traffic overview — powered by OpenSky</p>

      {loading && <p>Loading live flights...</p>}
      {!loading && (
        <>
          <p>Loaded Flights: {flights.length}</p>
          <p>Last Updated: {lastUpdate}</p>

          {/* 🔥 Add the live map */}
          <div className="live-map-container">
  <h3 className="map-title">Live Radar Map</h3>
  <LiveMap flights={flights} />
</div>

        </>
      )}
    </div>
  );
}