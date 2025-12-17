import './RouteMap.css';
import React, { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

// Fix marker icons
import "leaflet/dist/leaflet.css";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Plane icon
const planeIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [35, 35],
  iconAnchor: [17, 17],
});

// Smooth plane animation component
function AnimatedPlane({ coords }) {
  const map = useMap();

  // interpolation function (adds smooth positions)
  function interpolate(p1, p2, steps = 300) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const lat = p1[0] + ((p2[0] - p1[0]) * i) / steps;
      const lng = p1[1] + ((p2[1] - p1[1]) * i) / steps;
      points.push([lat, lng]);
    }
    return points;
  }

  useEffect(() => {
    if (!coords || coords.length < 2) return;

    // Build a long smooth route by interpolating
    let smoothCoords = [];
    for (let i = 0; i < coords.length - 1; i++) {
      smoothCoords = smoothCoords.concat(interpolate(coords[i], coords[i + 1], 400));
    }

    const plane = L.marker(smoothCoords[0], { icon: planeIcon }).addTo(map);

    // Fit map to route
    map.fitBounds(coords, { padding: [50, 50] });

    let index = 0;

    function fly() {
      if (index >= smoothCoords.length) return;

      plane.setLatLng(smoothCoords[index]);
      index++;

      requestAnimationFrame(fly);
    }

    fly();
  }, [coords, map]);

  return null;
}

export default function RouteMap({ coords, airports }) {
  if (!coords || coords.length === 0) return <p>No map data.</p>;

  return (
    <div style={{ height: "350px", width: "100%", marginTop: "15px" }}>
      <MapContainer
        center={coords[0]}
        zoom={5}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", borderRadius: "12px" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />

        {/* Route Line */}
        <Polyline positions={coords} weight={5} color="#4F46E5" />

        {/* Airport markers */}
        {coords.map((point, idx) => (
          <Marker key={idx} position={point}>
            <Tooltip>
              <b>{airports[idx]}</b>
            </Tooltip>
          </Marker>
        ))}

        {/* ✈️ Animated plane */}
        <AnimatedPlane coords={coords} />
      </MapContainer>
    </div>
  );
}
