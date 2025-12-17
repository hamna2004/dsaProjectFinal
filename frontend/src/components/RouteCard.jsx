// frontend/src/components/RouteCard.jsx
import React from "react";

export default function RouteCard({ title, route, highlight = false, onSelect }) {
  const price = route.total_price ?? route.totalPriceUSD ?? 0;
  const duration = route.total_duration ?? route.totalDurationMin ?? 0;
  return (
    <div className={`route-card ${highlight ? "highlight" : ""}`} onClick={() => onSelect && onSelect(route)}>
      <div className="rc-header">
        <div className="rc-title">{title}</div>
        <div className="rc-meta">
          <span className="pill">{route.stops} stops</span>
          <span className="sep" />
          <span className="price">${price}</span>
          <span className="sep" /> <span>{Math.round(duration/60)}h {duration%60}m</span>
        </div>
      </div>

      <div className="rc-legs">
        {(route.flights || route.legs || []).map((leg, i) => (
          <div className="rc-leg" key={leg.id ?? `${leg.flight_no}_${i}`}>
            <div className="leg-route">{leg.source_code ?? leg.from} → {leg.dest_code ?? leg.to}</div>
            <div className="leg-meta">{leg.airline ?? ""} {leg.flight_no ?? leg.flightNo} · {leg.duration ?? leg.durationMin}m</div>
          </div>
        ))}
      </div>

      <div className="rc-actions">
        <button className="btn btn--ghost">Details</button>
        <button className="btn btn--primary">Save</button>
      </div>
    </div>
  );
}
