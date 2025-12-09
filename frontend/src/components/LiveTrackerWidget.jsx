import React, { useEffect, useState } from "react";
import "./LiveTrackerWidget.css";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function LiveTrackerWidget({ airport = "DXB", bbox = null, pollInterval = 20000 }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [poll, setPoll] = useState(true);

  const fetchLive = async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (airport) params.append("airport", airport);
      if (bbox) params.append("bbox", bbox);
      const res = await fetch(`${API}/api/live?${params.toString()}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Live fetch error", e);
      setErr(e.message || "Fetch error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLive();
    if (!pollInterval) return;
    const id = setInterval(() => {
      if (poll) fetchLive();
    }, pollInterval);
    return () => clearInterval(id);
  }, [airport, bbox, pollInterval, poll]);

  if (loading && !data) return <div className="ltw-card">Loading live flights…</div>;
  if (err) return <div className="ltw-card">Live tracker error: {err}</div>;

  const flightsCount = data?.flights_count ?? 0;
  const mostActive = data?.most_active_region?.country || "Unknown";
  const incoming = data?.incoming;

  return (
    <div className="ltw-card">
      <div className="ltw-header">
        <h4>Live Flights</h4>
        <div className="ltw-controls">
          <button onClick={fetchLive} className="ltw-small">Refresh</button>
          <button onClick={() => setPoll(p => !p)} className="ltw-small">
            {poll ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      <div className="ltw-body">
        <div className="ltw-item">
          <div className="ltw-label">✈ Live flights</div>
          <div className="ltw-value">{flightsCount}</div>
        </div>

        <div className="ltw-item">
          <div className="ltw-label">🔜 Next incoming</div>
          <div className="ltw-value">
            {incoming ? <div>{incoming.callsign || incoming.icao24} <small>{incoming.distance_km} km</small></div> : <div>—</div>}
          </div>
        </div>

        <div className="ltw-item">
          <div className="ltw-label">🌍 Most active</div>
          <div className="ltw-value">{mostActive} ({data?.most_active_region?.count ?? 0})</div>
        </div>
      </div>

      <div className="ltw-footer">
        <small>Updated: {new Date((data?.timestamp || Date.now()) * 1000).toLocaleTimeString()}</small>
      </div>
    </div>
  );
}
