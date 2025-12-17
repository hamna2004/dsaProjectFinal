import React from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

// ✈ Custom airplane icon
const planeIcon = L.divIcon({
  html: "✈️",
  className: "plane-icon",
  iconSize: [30, 30],
});

export default function LiveMap({ flights }) {
  return (
    <div style={{ marginTop: "30px" }}>
      <h3 style={{ color: "white", marginBottom: "10px" }}>Live Radar Map</h3>

      <MapContainer
        center={[25, 55]}
        zoom={4}
        scrollWheelZoom={false}
        style={{ height: "500px", width: "100%", borderRadius: "10px" }}
      >
        {/* Map layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Add a marker for every flight */}
        {flights.slice(0, 200).map((flight, index) => {
          const lat = flight[6];
          const lon = flight[5];
          const callsign = flight[1];

          // Skip invalid coordinates
          if (!lat || !lon) return null;

          return (
            <Marker
              key={index}
              position={[lat, lon]}
              icon={planeIcon}
            >
              <Tooltip>
                <b>{callsign || "Unknown"}</b>
                <br />
                Lat: {lat.toFixed(2)} <br />
                Lon: {lon.toFixed(2)}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
