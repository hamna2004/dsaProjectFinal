import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import PropTypes from "prop-types";
import "leaflet-rotatedmarker";
import "./PakistanFlightTracker.css";
import { fetchFlights, findOptimalRoute } from "../services/api";

const REFRESH_INTERVAL_MS = 10000;
const REGION_QUERY = {
  lamin: 20,
  lamax: 36.5,
  lomin: 55,
  lomax: 78,
};
const MAP_BOUNDS = [
  [REGION_QUERY.lamin, REGION_QUERY.lomin],
  [REGION_QUERY.lamax, REGION_QUERY.lomax],
];

const REGION_AIRPORTS = [
  { code: "KHI", name: "Karachi Jinnah Intl", lat: 24.9065, lon: 67.1608 },
  { code: "LHE", name: "Lahore Allama Iqbal", lat: 31.5216, lon: 74.4036 },
  { code: "ISB", name: "Islamabad Intl", lat: 33.5486, lon: 72.8259 },
  { code: "DXB", name: "Dubai Intl", lat: 25.2532, lon: 55.3657 },
  { code: "DOH", name: "Doha Hamad Intl", lat: 25.2736, lon: 51.6081 },
  { code: "IST", name: "Istanbul Airport", lat: 41.2753, lon: 28.7519 },
];

const createPlaneIcon = (active = false) =>
  L.divIcon({
    className: `tracker-plane-icon${
      active ? " tracker-plane-icon--active" : ""
    }`,
    html: '<div class="tracker-plane-icon__glyph">✈</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const OPENSKY_URL = `https://opensky-network.org/api/states/all?${new URLSearchParams(
  REGION_QUERY,
).toString()}`;

const normalizeStateVector = (state = []) => ({
  icao24: state[0],
  callsign: state[1]?.trim() || "UNKNOWN",
  origin_country: state[2],
  time_position: state[3],
  last_contact: state[4],
  longitude: state[5],
  latitude: state[6],
  baro_altitude: state[7],
  on_ground: state[8],
  velocity: state[9],
  true_track: state[10],
  vertical_rate: state[11],
  geo_altitude: state[13],
  squawk: state[14],
});

const haversine = (lat1, lon1, lat2, lon2) => {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
};

const formatNumber = (value, options = {}) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { digits = 0, suffix = "", unit = "" } = options;
  return `${Number(value).toFixed(digits)}${suffix}${unit}`;
};

export default function PakistanFlightTracker({ onClose }) {
  const [flights, setFlights] = useState([]);
  const [selectedIcao24, setSelectedIcao24] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [routeStatus, setRouteStatus] = useState("idle");
  const [routeError, setRouteError] = useState(null);
  const [flightPriceMap, setFlightPriceMap] = useState({});

  const mapRef = useRef(null);

  const loadFlights = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(OPENSKY_URL);
      if (!res.ok) {
        throw new Error(`OpenSky error ${res.status}`);
      }
      const json = await res.json();
      const normalized =
        json?.states
          ?.map(normalizeStateVector)
          .filter(
            (state) =>
              typeof state.latitude === "number" &&
              typeof state.longitude === "number",
          ) || [];
      setFlights(normalized);
      setLastUpdated(
        new Date((json?.time || Date.now() / 1000) * 1000).toLocaleTimeString(),
      );
      setLoading(false);
    } catch (err) {
      console.error("Failed to load OpenSky", err);
      setError(err.message || "Unable to load flights");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlights();
    const interval = setInterval(loadFlights, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadFlights]);

  useEffect(() => {
    let active = true;
    const loadPriceMap = async () => {
      try {
        const allFlights = await fetchFlights();
        if (!active) return;
        const map = {};
        allFlights.forEach((flight) => {
          const code = flight?.flight_no;
          if (!code) return;
          const normalized = String(code).trim().toUpperCase();
          if (!normalized) return;
          const rawPrice = flight?.price;
          const parsed =
            typeof rawPrice === "number"
              ? rawPrice
              : rawPrice
              ? Number(rawPrice)
              : null;
          map[normalized] = Number.isFinite(parsed) ? parsed : null;
        });
        setFlightPriceMap(map);
      } catch (err) {
        console.error("Failed to load flight prices", err);
      }
    };

    loadPriceMap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedIcao24) return;
    if (flights.length) {
      setSelectedIcao24(flights[0].icao24);
    }
  }, [flights, selectedIcao24]);

  const selectedFlight = useMemo(
    () => flights.find((f) => f.icao24 === selectedIcao24) || null,
    [flights, selectedIcao24],
  );

  const filteredFlights = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return flights.slice(0, 30);
    return flights
      .filter(
        (flight) =>
          flight.callsign?.toLowerCase().includes(term) ||
          flight.icao24?.includes(term),
      )
      .slice(0, 30);
  }, [flights, searchTerm]);

  const proximity = useMemo(() => {
    if (!selectedFlight?.latitude || !selectedFlight?.longitude) return null;
    const ranking = REGION_AIRPORTS.map((airport) => ({
      ...airport,
      distance: haversine(
        selectedFlight.latitude,
        selectedFlight.longitude,
        airport.lat,
        airport.lon,
      ),
    }))
      .filter((entry) => entry.distance !== null)
      .sort((a, b) => a.distance - b.distance);
    if (!ranking.length) return null;
    return {
      primary: ranking[0],
      secondary: ranking[1] || null,
      ranking,
    };
  }, [selectedFlight]);

  const arrivalEstimate = useMemo(() => {
    if (!selectedFlight || !proximity?.primary) return null;

    const distanceKm = proximity.primary.distance;
    const velocityKmh = selectedFlight.velocity
      ? selectedFlight.velocity * 3.6
      : null;

    if (!velocityKmh || velocityKmh < 60) {
      return {
        airport: proximity.primary,
        distanceKm,
        etaMinutes: null,
        note: "Speed too low for ETA",
      };
    }

    const etaMinutes = (distanceKm / velocityKmh) * 60;
    return {
      airport: proximity.primary,
      distanceKm,
      etaMinutes,
      etaTimestamp: new Date(Date.now() + etaMinutes * 60 * 1000),
    };
  }, [selectedFlight, proximity]);

  useEffect(() => {
    const loadRoute = async () => {
      if (!proximity?.primary || !proximity?.secondary) {
        setOptimizedRoute(null);
        setRouteError(null);
        return;
      }
      setRouteStatus("loading");
      setRouteError(null);
      try {
        const response = await findOptimalRoute(
          proximity.secondary.code,
          proximity.primary.code,
          "cheapest",
        );
        if (response?.success && response?.route) {
          setOptimizedRoute(response.route);
        } else {
          setOptimizedRoute(null);
          setRouteError(response?.error || "No optimized route available");
        }
      } catch (err) {
        setOptimizedRoute(null);
        setRouteError(err.message || "Route planner unavailable");
      } finally {
        setRouteStatus("ready");
      }
    };

    loadRoute();
  }, [
    proximity?.primary?.code,
    proximity?.secondary?.code,
    selectedFlight?.icao24,
  ]);

  const optimizedPolyline = useMemo(() => {
    if (!optimizedRoute?.coords) return null;
    return optimizedRoute.coords.map(([lat, lon]) => [lat, lon]);
  }, [optimizedRoute]);

  const realRoutePolyline = useMemo(() => {
    if (!selectedFlight?.latitude || !proximity?.primary) return null;
    return [
      [selectedFlight.latitude, selectedFlight.longitude],
      [proximity.primary.lat, proximity.primary.lon],
    ];
  }, [selectedFlight, proximity]);

  const mapReady = useCallback((mapInstance) => {
    mapRef.current = mapInstance;
    mapInstance.fitBounds(MAP_BOUNDS, { padding: [20, 20] });
  }, []);

  const normalizedCallsign = useMemo(() => {
    if (!selectedFlight?.callsign) return null;
    return selectedFlight.callsign.replace(/\s+/g, "").toUpperCase();
  }, [selectedFlight?.callsign]);

  const realRoutePriceUSD = useMemo(() => {
    if (!normalizedCallsign) return null;
    return flightPriceMap[normalizedCallsign] ?? null;
  }, [normalizedCallsign, flightPriceMap]);

  const optimizedPriceUSD =
    optimizedRoute?.totalPriceUSD !== undefined
      ? optimizedRoute.totalPriceUSD
      : null;

  const featureSummary = useMemo(() => {
    const arrivalText = arrivalEstimate
      ? arrivalEstimate.etaMinutes
        ? `${arrivalEstimate.airport.code} • ETA ${formatNumber(
            arrivalEstimate.etaMinutes,
            { digits: 0, suffix: " min" },
          )}`
        : arrivalEstimate.note || "Need more data"
      : "Select a flight";

    const distanceComparisonText = optimizedRoute
      ? `${Math.round(
          optimizedRoute.totalDistanceKM,
        )} km vs ${arrivalEstimate?.distanceKm?.toFixed(0) || "—"} km`
      : routeError || (routeStatus === "loading" ? "Loading..." : "Not ready");

    const priceComparisonText =
      optimizedPriceUSD !== null || realRoutePriceUSD !== null
        ? `${optimizedPriceUSD !== null ? `$${optimizedPriceUSD.toFixed(0)}` : "—"} vs ${
            realRoutePriceUSD !== null ? `$${realRoutePriceUSD.toFixed(0)}` : "—"
          }`
        : null;

    const routeText = priceComparisonText
      ? `${distanceComparisonText} • ${priceComparisonText}`
      : distanceComparisonText;

    return [
      {
        title: "All flights in your region (Pakistan / Middle East)",
        value: flights.length,
      },
      {
        title: "Real-time map with moving plane icons",
        value: lastUpdated ? `Live • ${lastUpdated}` : "Syncing…",
      },
      {
        title: "Clicking a plane opens a details sidebar",
        value: selectedFlight?.callsign || "Select a plane",
      },
      {
        title: "Search any flight (PK301, EK603, QR610 etc.)",
        value: searchTerm
          ? `${filteredFlights.length} match${
              filteredFlights.length === 1 ? "" : "es"
            }`
          : "Type to filter",
      },
      {
        title: "Show estimated arrival time and route on map",
        value: arrivalText,
      },
      {
        title: "Show your optimized route vs. real route (AMAZING FEATURE)",
        value: routeText,
      },
    ];
  }, [
    arrivalEstimate,
    flights.length,
    filteredFlights.length,
    lastUpdated,
    optimizedRoute,
    routeError,
    routeStatus,
    optimizedPriceUSD,
    realRoutePriceUSD,
    searchTerm,
    selectedFlight?.callsign,
  ]);

  const detailItems = selectedFlight
    ? [
        {
          label: "Callsign",
          value: selectedFlight.callsign,
        },
        {
          label: "ICAO24",
          value: selectedFlight.icao24,
        },
        {
          label: "Origin Country",
          value: selectedFlight.origin_country,
        },
        {
          label: "Altitude",
          value: formatNumber(selectedFlight.geo_altitude || selectedFlight.baro_altitude, {
            digits: 0,
            suffix: " m",
          }),
        },
        {
          label: "Velocity",
          value: formatNumber(
            selectedFlight.velocity ? selectedFlight.velocity * 3.6 : null,
            { digits: 0, suffix: " km/h" },
          ),
        },
        {
          label: "Heading",
          value: formatNumber(selectedFlight.true_track, {
            digits: 0,
            suffix: "°",
          }),
        },
        {
          label: "Squawk",
          value: selectedFlight.squawk || "—",
        },
        {
          label: "Last Contact",
          value: selectedFlight.last_contact
            ? new Date(selectedFlight.last_contact * 1000).toLocaleTimeString()
            : "—",
        },
        {
          label: "Optimized Route Price",
          value:
            optimizedPriceUSD !== null
              ? `$${optimizedPriceUSD.toFixed(0)}`
              : "—",
        },
        {
          label: "Real Route Price",
          value:
            realRoutePriceUSD !== null
              ? `$${realRoutePriceUSD.toFixed(0)}`
              : "Not mapped",
        },
      ]
    : [];

  return (
    <div className="tracker-overlay">
      <div className="tracker-shell">
        <header className="tracker-header">
          <div>
            <h3>Pakistan Airspace Flight Tracker</h3>
            <p>Powered by OpenSky — refreshed every 10 seconds</p>
          </div>
          <button className="tracker-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="tracker-body">
          <div className="tracker-map">
            {loading && (
              <div className="tracker-map__empty">Loading live flights…</div>
            )}
            {error && (
              <div className="tracker-map__empty tracker-map__error">
                {error}
              </div>
            )}
            {!loading && !error && (
              <MapContainer
                center={[28, 67]}
                zoom={5}
                minZoom={4}
                maxZoom={8}
                whenCreated={mapReady}
                zoomControl={false}
                style={{ width: "100%", height: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {optimizedPolyline && (
                  <Polyline
                    positions={optimizedPolyline}
                    pathOptions={{
                      color: "#0ea5e9",
                      weight: 4,
                      dashArray: "8 6",
                    }}
                  />
                )}

                {realRoutePolyline && (
                  <Polyline
                    positions={realRoutePolyline}
                    pathOptions={{
                      color: "#f97316",
                      weight: 4,
                      dashArray: "0",
                    }}
                  />
                )}

                {flights.map((flight) => (
                  <Marker
                    key={flight.icao24}
                    position={[flight.latitude, flight.longitude]}
                    icon={createPlaneIcon(flight.icao24 === selectedIcao24)}
                    eventHandlers={{
                      click: () => setSelectedIcao24(flight.icao24),
                    }}
                    rotationAngle={flight.true_track || 0}
                    rotationOrigin="center"
                  >
                    <Tooltip>
                      <strong>{flight.callsign || "Unknown"}</strong>
                      <br />
                      {formatNumber(flight.latitude, { digits: 2 })},{" "}
                      {formatNumber(flight.longitude, { digits: 2 })}
                    </Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>

          <aside className="tracker-sidebar">
            <div>
              <label className="tracker-label" htmlFor="tracker-search">
                Search any flight
              </label>
              <input
                id="tracker-search"
                type="text"
                placeholder="Try PK301, EK603, QR610…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="tracker-flight-list">
              {filteredFlights.map((flight) => (
                <button
                  key={flight.icao24}
                  className={`tracker-flight ${
                    flight.icao24 === selectedIcao24 ? "is-active" : ""
                  }`}
                  onClick={() => setSelectedIcao24(flight.icao24)}
                >
                  <span>{flight.callsign}</span>
                  <small>{flight.origin_country}</small>
                </button>
              ))}
              {!filteredFlights.length && (
                <div className="tracker-flight tracker-flight--empty">
                  No flights match that search.
                </div>
              )}
            </div>

            <div className="tracker-details">
              {selectedFlight ? (
                <>
                  <div className="tracker-details__heading">
                    <h4>{selectedFlight.callsign}</h4>
                    <p>
                      {arrivalEstimate?.airport
                        ? `Nearest: ${arrivalEstimate.airport.name}`
                        : "Select a plane to view details"}
                    </p>
                  </div>
                  <div className="tracker-details__grid">
                    {detailItems.map((item) => (
                      <div key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p>Select a plane to see detailed telemetry.</p>
              )}
            </div>

            <div className="tracker-features">
              {featureSummary.map((feature) => (
                <div key={feature.title} className="tracker-feature">
                  <span>{feature.title}</span>
                  <strong>{feature.value}</strong>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

PakistanFlightTracker.propTypes = {
  onClose: PropTypes.func.isRequired,
};



