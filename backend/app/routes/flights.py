from flask import Blueprint, jsonify, request

# Import service functions that handle database operations
from ..services.flights_service import fetch_all_flights, search_flights, get_dashboard_stats

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
    Supports searching using Linear Search algorithm and sorting using Merge Sort algorithm.
    
    Query parameters:
    - source: source airport code (e.g., "KHI")
    - dest: destination airport code (e.g., "LHE")
    - search: search query string to filter flights by flight_no, airline, or airport codes (optional)
    - sort: sorting key - 'price', 'duration', or 'airline' (optional)
    """
    # If the parameter doesn't exist, it returns None
    source = request.args.get("source")
    dest = request.args.get("dest")
    search_query = request.args.get("search")  # Get search query parameter
    sort_key = request.args.get("sort")  # Get sort parameter
    
    # Validate sort_key
    if sort_key and sort_key not in ["price", "duration", "airline"]:
        return jsonify({
            "error": "Invalid sort parameter. Must be 'price', 'duration', or 'airline'"
        }), 400
    
    if source or dest:
        flights = search_flights(source_code=source, dest_code=dest, sort_key=sort_key, search_query=search_query)
    else:
        flights = fetch_all_flights(sort_key=sort_key, search_query=search_query)
    
    return jsonify(flights)


@flights_bp.route("/stats", methods=["GET"])
def get_stats():
    
    stats = get_dashboard_stats()
    return jsonify(stats)

"""
    GET /api/flights/stats
    Returns dashboard statistics: total flights, active routes, and average price.
    """



