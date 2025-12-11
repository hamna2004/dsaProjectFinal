from flask import Blueprint, jsonify, request

# Import service functions that handle database operations
from ..services.flights_service import fetch_all_flights, search_flights, get_dashboard_stats

# Import function to sync flights from external APIs
from ..services.flight_api_service import fetch_and_sync_real_time_flights

#creates blueprint for all flight related routes
flights_bp = Blueprint("flights", __name__, url_prefix="/api/flights")

# This route can do two things:
# 1. If no query parameters: return ALL flights
# 2. If source/dest provided: return filtered flights
@flights_bp.route("", methods=["GET"])
def get_flights():
    """
    GET /api/flights
    Returns all flights, or filtered flights if query parameters are provided.
    
    Query parameters:
    - source: source airport code (e.g., "KHI")
    - dest: destination airport code (e.g., "LHE")
    """
    # If the parameter doesn't exist, it returns None
    source = request.args.get("source")
    dest = request.args.get("dest")
    
    if source or dest:
        flights = search_flights(source_code=source, dest_code=dest)
    else:
        flights = fetch_all_flights()
    
    return jsonify(flights)


@flights_bp.route("/<int:flight_id>", methods=["GET"])
def get_flight_by_id(flight_id):
    """
    GET /api/flights/:id
    Returns a specific flight by ID.
    """
    all_flights = fetch_all_flights()
    # Loop through all flights and find the one with matching ID
    #next() function returns first value that matches its condition
    #otherwise returns the default value "None"
    flight = next((f for f in all_flights if f["id"] == flight_id), None)
    
    if not flight:
        return jsonify({"error": "Flight not found"}), 404
    
    return jsonify(flight)


@flights_bp.route("/sync", methods=["POST"])
def sync_flights():
    """
    POST /api/flights/sync
    Fetches real-time flight data from external APIs and syncs to database.
    
    Body (JSON, optional):
    {
        "api_key": "your_aviationstack_api_key",  // Optional, for AviationStack
        "source": "LHE",  // Optional, filter by source airport
        "dest": "JFK"     // Optional, filter by destination airport
    }
    """
    data = request.get_json() or {}
    api_key = data.get("api_key") or request.args.get("api_key")
    source_code = data.get("source") or request.args.get("source")
    dest_code = data.get("dest") or request.args.get("dest")
    
    print(f"=== SYNC REQUEST ===")
    print(f"Request method: {request.method}")
    print(f"Request content type: {request.content_type}")
    print(f"Request data: {data}")
    print(f"API key received: {api_key[:15] if api_key else 'None'}...")
    print(f"API key length: {len(api_key) if api_key else 0}")
    print(f"===================")
    
    result = fetch_and_sync_real_time_flights(
        api_key=api_key,
        source_code=source_code,
        dest_code=dest_code
    )
    
    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify({
            "success": False,
            "message": "Failed to fetch flights. Make sure you have an API key for AviationStack, or use OpenSky (limited data)."
        }), 400


@flights_bp.route("/stats", methods=["GET"])
def get_stats():
    """
    GET /api/flights/stats
    Returns dashboard statistics: total flights, active routes, and average price.
    """
    stats = get_dashboard_stats()
    return jsonify(stats)

