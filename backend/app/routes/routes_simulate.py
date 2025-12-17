from flask import Blueprint, jsonify, request
from ..services.route_calculator import dijkstra_simulate, compare_dijkstra_implementations
from ..db.connection import get_db_connection

simulate_bp = Blueprint("simulate", __name__, url_prefix="/api/simulate")

@simulate_bp.route("/dijkstra", methods=["GET"])
def simulate_dijkstra():
    # params
    source = request.args.get("source")
    dest = request.args.get("dest")
    mode = request.args.get("mode", "cheapest").strip().lower()
    max_states = int(request.args.get("max_states", 300))

    if not source or not dest:
        return jsonify({"success": False, "error": "source & dest required"}), 400

    # connect DB
    get_db_connection()

    # select weight_fn based on mode
    if mode == "cheapest":
        weight_fn = lambda e: e.get("priceUSD", 0.0)
    elif mode == "fastest":
        weight_fn = lambda e: e.get("durationMin", 0)
    else:
        # for shortest distance we use precomputed distances (but Dijkstra simulate expects weight fn)
        # we'll use price by default unless you want a specialized a_star simulated flow
        weight_fn = lambda e: e.get("priceUSD", 0.0)

    result = dijkstra_simulate(source, dest, weight_fn, max_states=max_states)
    return jsonify({"success": True, "route": result["route"], "states": result["states"]})

@simulate_bp.route("/compare-performance", methods=["GET"])
def compare_performance():
    """Compare array-based vs heap-based Dijkstra performance"""
    source = request.args.get("source")
    dest = request.args.get("dest")
    mode = request.args.get("mode", "cheapest").strip().lower()
    
    if not source or not dest:
        return jsonify({"success": False, "error": "source & dest required"}), 400
    
    get_db_connection()
    
    # Select weight function based on mode
    if mode == "cheapest":
        weight_fn = lambda e: e.get("priceUSD", 0.0)
    elif mode == "fastest":
        weight_fn = lambda e: e.get("durationMin", 0)
    else:
        weight_fn = lambda e: e.get("priceUSD", 0.0)
    
    try:
        result = compare_dijkstra_implementations(source, dest, weight_fn)
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
