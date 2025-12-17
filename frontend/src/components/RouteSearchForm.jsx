// frontend/src/components/RouteSearchForm.jsx
import React, { useState } from "react";

export default function RouteSearchForm({ onSearch, defaultMaxStops = 2 }) {
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [optimization, setOptimization] = useState("all");
  const [date, setDate] = useState("");
  const [maxStops, setMaxStops] = useState(defaultMaxStops);

  function handleSubmit(e) {
    e.preventDefault();
    if (!source || !dest) return alert("Please enter both origin and destination.");
    onSearch({ source: source.trim().toUpperCase(), dest: dest.trim().toUpperCase(), optimization, max_stops: maxStops, date });
  }

  return (
    <form className="rp-search-card" onSubmit={handleSubmit}>
      <div className="rp-row">
        <div className="rp-field">
          <label>From</label>
          <input value={source} onChange={e => setSource(e.target.value)} placeholder="KHI" />
        </div>
        <div className="rp-field">
          <label>To</label>
          <input value={dest} onChange={e => setDest(e.target.value)} placeholder="LHR" />
        </div>
        <div className="rp-field">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div className="rp-row">
        <div className="rp-field small">
          <label>Max stops</label>
          <select value={maxStops} onChange={e => setMaxStops(Number(e.target.value))}>
            <option value={0}>Direct</option>
            <option value={1}>Up to 1</option>
            <option value={2}>Up to 2</option>
            <option value={3}>Up to 3</option>
          </select>
        </div>

        <div className="rp-field expand">
          <label>Optimization</label>
          <div className="rp-toggle">
            <button type="button" className={optimization==="all" ? "active":""} onClick={()=>setOptimization("all")}>All</button>
            <button type="button" className={optimization==="cheapest" ? "active":""} onClick={()=>setOptimization("cheapest")}>Cheapest</button>
            <button type="button" className={optimization==="fastest" ? "active":""} onClick={()=>setOptimization("fastest")}>Fastest</button>
          </div>
        </div>

        <div className="rp-field actions">
          <button type="submit" className="btn btn--primary">Find Routes</button>
        </div>
      </div>
    </form>
  );
}
