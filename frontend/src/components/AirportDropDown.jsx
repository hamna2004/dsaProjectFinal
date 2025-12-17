import React from "react";

export default function AirportDropdown({ label, airports, value, onChange }) {
  return (
    <div className="rp-field">
      <label>{label}</label>

      <select
        className="rp-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select airport</option>

        {airports.map((a) => (
          <option key={a.id} value={a.code}>
            {a.code} — {a.city}
          </option>
        ))}
      </select>
    </div>
  );
}
