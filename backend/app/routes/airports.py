# Import Flask's Blueprint class - this lets us create a group of routes
from flask import Blueprint, jsonify
# Import the service function that does the actual database work
from ..services.airports_service import fetch_all_airports


# This creates a "blueprint" (a group of routes) for airports
# Parameters:
# - "airports" = name of the blueprint (for debugging/identification)
# - __name__ = tells Flask where this blueprint is defined

airports_bp = Blueprint("airports", __name__, url_prefix="/api/airports")

@airports_bp.route("", methods=["GET"])
def get_airports():
    airports = fetch_all_airports()
    return jsonify(airports)

    """
    WHAT THIS FUNCTION DOES:
    - Handles GET requests to /api/airports
    - Returns a list of all airports in the database
    - Call the service function to get airports from database
    - The service function handles all the database queries
    - We just get the result and send it to the frontend
    """



