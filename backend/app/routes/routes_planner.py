from flask import Blueprint, jsonify, request


from ..services.route_calculator import find_optimal_route, find_routes, compare_all_algorithms, find_pareto_optimal_routes;
from ..db.connection import get_db_connection

ALLOWED_OPTIMIZATIONS = {"all", "cheapest", "fastest", "shortest", "best_overall", "pareto"}

routes_bp = Blueprint("routes", __name__, url_prefix="/api/routes")


@routes_bp.route("/find", methods=["GET"])
def find_route():
    """
    GET /api/routes/find?source=LHE&dest=JFK&optimization=cheapest

    Returns:
    - all routes (if optimization = all)
    - best optimized route (cheapest / fastest / shortest)
    Includes:
    - path
    - legs
    - price, duration, distance
    - coordinates
    - DSA stats (nodes, edges, runtime)
    """

    source = request.args.get("source")
    dest = request.args.get("dest")
    optimization = request.args.get("optimization", "all")
    max_stops_raw = request.args.get("max_stops", 2)

    # -----------------------------
    # VALIDATION
    # -----------------------------
    if not source or not dest:
        return jsonify({
            "success": False,
            "error": "Both 'source' and 'dest' parameters are required"
        }), 400

    source = source.strip().upper()
    dest = dest.strip().upper()
    optimization = optimization.strip().lower()

    try:
        max_stops = int(max_stops_raw)
        if not (0 <= max_stops <= 4):
            return jsonify({
                "success": False,
                "error": "max_stops must be between 0 and 4"
            }), 400
    except:
        return jsonify({
            "success": False,
            "error": "max_stops must be an integer"
        }), 400

    if optimization not in ALLOWED_OPTIMIZATIONS:
        return jsonify({
            "success": False,
            "error": f"optimization must be one of {', '.join(sorted(ALLOWED_OPTIMIZATIONS))}"
        }), 400

    # -----------------------------
    # PROCESSING
    # -----------------------------
    get_db_connection()

    try:
        if optimization == "all":
            # Get all routes from DFS
            routes = find_routes(source, dest, max_stops=max_stops)
            
            # Also run all algorithms to show which one picks which route
            algorithm_comparison = compare_all_algorithms(source, dest)
            
            return jsonify({
                "success": True,
                "total_routes": len(routes),
                "routes": routes,  # contains path, legs, coords, distance, stats
                "algorithm_results": {
                    "cheapest": algorithm_comparison.get("cheapest"),
                    "fastest": algorithm_comparison.get("fastest"),
                    "shortest": algorithm_comparison.get("shortest"),
                    "best_overall": algorithm_comparison.get("best_overall"),
                    "algorithm_used": algorithm_comparison.get("algorithm_used")
                }
            }), 200

        elif optimization == "best_overall":
            # Use multi-criteria Dijkstra algorithm (proper heuristic)
            best = find_optimal_route(source, dest, max_stops=max_stops, mode="best_overall")
            
            if not best:
                return jsonify({
                    "success": False,
                    "error": "No route found"
                }), 404
            
            # Also get individual algorithm results for comparison
            comparison = compare_all_algorithms(source, dest)
            
            return jsonify({
                "success": True,
                "route": best,
                "algorithm_used": "multi_criteria_dijkstra",
                "comparison": {
                    "cheapest": comparison.get("cheapest"),
                    "fastest": comparison.get("fastest"),
                    "shortest": comparison.get("shortest")
                }
            }), 200

        elif optimization == "pareto":
            # Use Pareto optimal algorithm to find all non-dominated routes
            pareto_result = find_pareto_optimal_routes(source, dest)
            
            if not pareto_result or pareto_result.get("pareto_count", 0) == 0:
                return jsonify({
                    "success": False,
                    "error": "No Pareto optimal routes found"
                }), 404
            
            return jsonify({
                "success": True,
                "routes": pareto_result.get("pareto_routes", []),
                "all_candidates": pareto_result.get("all_candidates", []),  # Include ALL candidates for visualization
                "total_candidates": pareto_result.get("total_candidates", 0),
                "pareto_count": pareto_result.get("pareto_count", 0),
                "algorithm_used": "pareto_optimal"
            }), 200

        else:
            # Specific mode: cheapest, fastest, or shortest
            best = find_optimal_route(source, dest, max_stops=max_stops, mode=optimization)

            if not best:
                return jsonify({
                    "success": False,
                    "error": "No route found"
                }), 404
            return jsonify({
                "success": True,
                "route": best,  # contains enhanced data
                "algorithm_used": optimization
            }), 200

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"ERROR in /api/routes/find: {error_detail}")  # Log to console for debugging
        return jsonify({
            "success": False,
            "error": "Server error",
            "detail": str(e)
        }), 500




