# backend/app/routes/live.py
import time
import math
import requests
from flask import Blueprint, request, jsonify
from ..db.connection import get_db_connection

live_bp = Blueprint("live", __name__, url_prefix="/api/live")

# Simple in-memory cache (process-local). For production, use Redis.
_CACHE = {
    "data": None,
    "ts": 0,
    "ttl": 20  # seconds; tune this to avoid OpenSky rate limits
}

OPENSKY_URL = "https://opensky-network.org/api/states/all"


def haversine_km(lat1, lon1, lat2, lon2):
    # returns distance in km
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def fetch_opensky(states_bbox=None):
    """
    Call OpenSky /states/all optionally with bounding box.
    states_bbox: tuple (lamin, lomin, lamax, lomax) or None
    """
    params = {}
    if states_bbox:
        lamin, lomin, lamax, lomax = states_bbox
        params = {"lamin": lamin, "lomin": lomin, "lamax": lamax, "lomax": lomax}

    resp = requests.get(OPENSKY_URL, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()  # contains 'time' and 'states'


def get_airport_coords(code):
    """Return (latitude, longitude) for airport code from DB or None."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT latitude, longitude FROM airports WHERE code = %s LIMIT 1", (code.upper(),))
    row = cursor.fetchone()
    cursor.close()
    if not row or row["latitude"] is None or row["longitude"] is None:
        return None
    return float(row["latitude"]), float(row["longitude"])


@live_bp.route("", methods=["GET"])
def live_index():
    """
    GET /api/live
    Optional query params:
      - airport=DXB         -> show flights near that airport and "next incoming"
      - bbox=lat1,lon1,lat2,lon2  -> custom bounding box
      - ttl=30              -> override cache TTL in seconds (max 120)
    """
    # Use cache TTL from query but cap to 120s
    try:
        ttl = int(request.args.get("ttl", _CACHE["ttl"]))
        ttl = max(5, min(ttl, 120))
    except:
        ttl = _CACHE["ttl"]

    now = time.time()
    if _CACHE["data"] and (now - _CACHE["ts"] < ttl):
        data = _CACHE["data"]
    else:
        # fetch from OpenSky
        bbox_param = request.args.get("bbox")
        if bbox_param:
            try:
                parts = [float(x) for x in bbox_param.split(",")]
                if len(parts) == 4:
                    states_bbox = (parts[0], parts[1], parts[2], parts[3])  # lamin, lomin, lamax, lomax
                else:
                    states_bbox = None
            except:
                states_bbox = None
        else:
            states_bbox = None

        try:
            raw = fetch_opensky(states_bbox=states_bbox)
            # raw: { "time": 123456789, "states": [ [...], ... ] }
            _CACHE["data"] = raw
            _CACHE["ts"] = now
            data = raw
        except Exception as e:
            return jsonify({"success": False, "message": f"OpenSky fetch failed: {e}"}), 502

    # Process states into friendly objects
    states = data.get("states") or []
    # OpenSky state vector indices (per API):
    # 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
    # 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity (m/s),
    # 10: true_track (deg), 11: vertical_rate, ...
    flights = []
    for s in states:
        # skip invalid positions
        lat = s[6]
        lon = s[5]
        if lat is None or lon is None:
            continue
        flights.append({
            "icao24": s[0],
            "callsign": (s[1] or "").strip(),
            "origin_country": s[2],
            "time_position": s[3],
            "last_contact": s[4],
            "longitude": lon,
            "latitude": lat,
            "baro_altitude": s[7],
            "on_ground": s[8],
            "velocity_m_s": s[9],
            "track_deg": s[10]
        })

    # If airport provided, compute nearest incoming flight
    airport_code = request.args.get("airport")
    airport_coords = None
    incoming = None
    if airport_code:
        airport_coords = get_airport_coords(airport_code)
        if airport_coords:
            ax, ay = airport_coords[0], airport_coords[1]
            # find flights that are airborne (not on_ground) and compute distance to airport
            airborne = [f for f in flights if not f["on_ground"]]
            # compute distance and filter those heading roughly toward airport
            candidates = []
            for f in airborne:
                d = haversine_km(ax, ay, f["latitude"], f["longitude"])
                # compute bearing from aircraft to airport (approx)
                # simpler heuristic: if distance < X or track points towards airport (skip detailed bearing calc for brevity)
                candidates.append((d, f))
            if candidates:
                candidates.sort(key=lambda x: x[0])  # nearest first
                nearest = candidates[0][1]
                incoming = {
                    "callsign": nearest["callsign"],
                    "icao24": nearest["icao24"],
                    "distance_km": round(candidates[0][0], 1),
                    "latitude": nearest["latitude"],
                    "longitude": nearest["longitude"],
                    "velocity_m_s": nearest["velocity_m_s"],
                    "track_deg": nearest["track_deg"],
                }

    # compute most active region (count by origin_country)
    country_counts = {}
    for f in flights:
        c = f["origin_country"] or "Unknown"
        country_counts[c] = country_counts.get(c, 0) + 1
    most_active = None
    if country_counts:
        most_active_country = max(country_counts.items(), key=lambda x: x[1])
        most_active = {"country": most_active_country[0], "count": most_active_country[1]}

    result = {
        "success": True,
        "timestamp": data.get("time"),
        "total_states": len(states),
        "flights_count": len(flights),
        "most_active_region": most_active,
        "incoming": incoming,
        # send a small sample of flights for UI if you want to show a list
        "sample_flights": flights[:50]
    }

    return jsonify(result)
