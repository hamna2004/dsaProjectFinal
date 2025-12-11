from flask import Blueprint, jsonify, request
from ..services.graph_analyzer import (
    get_graph_stats,
    get_adjacency_list,
    get_adjacency_matrix,
    get_connected_components,
    get_route_graph_analysis,
    prim_mst_simulate,
    kruskal_mst_simulate
)
from ..db.connection import get_db_connection

graph_bp = Blueprint("graph", __name__, url_prefix="/api/graph")

@graph_bp.route("/stats", methods=["GET"])
def graph_stats():
    """
    GET /api/graph/stats - Get graph statistics
    Returns statistics about the entire flight network
    """
    try:
        get_db_connection()
        stats = get_graph_stats()
        return jsonify({
            "success": True,
            "data": stats
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@graph_bp.route("/adjacency-list", methods=["GET"])
def adjacency_list():
    """
    Returns the graph as an adjacency list representation
    This is the data structure used by Dijkstra's algorithm
    """
    try:
        get_db_connection()
        adj_list = get_adjacency_list()
        return jsonify({
            "success": True,
            "data": adj_list
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@graph_bp.route("/adjacency-matrix", methods=["GET"])
def adjacency_matrix():
    """
    WHAT THIS FUNCTION DOES:
    - Returns the flight network as an adjacency matrix
    - Adjacency matrix: 2D array where matrix[i][j] = 1 if there's a flight from airport i to airport j
    - Useful for quick lookups: "Is there a direct flight from A to B?"
    """
    try:
        get_db_connection()
        matrix_data = get_adjacency_matrix()
        return jsonify({
            "success": True,
            "data": matrix_data
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@graph_bp.route("/components", methods=["GET"])
def connected_components():
    """
     WHAT THIS FUNCTION DOES:
    - Finds all connected components in the flight network
    - Connected component: A group of airports that can reach each other
    - Uses BFS (Breadth-First Search) algorithm
    """
    try:
        get_db_connection()
        components = get_connected_components()
        return jsonify({
            "success": True,
            "data": components
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@graph_bp.route("/route-analysis", methods=["GET"])
def route_graph_analysis():
    """
    WHAT THIS FUNCTION DOES:
    - Analyzes the graph for a specific route (source → destination)
    - Shows a subgraph (airports/flights relevant to this route)
    - Counts path options (direct, one-stop, two-stop)
    - Provides network context (connectivity, degrees)
    """
    try:
        source = request.args.get("source")
        dest = request.args.get("dest")
        max_hops = int(request.args.get("max_hops", 3))
        
        if not source or not dest:
            return jsonify({
                "success": False,
                "error": "source and dest parameters are required"
            }), 400
        
        get_db_connection()
        analysis = get_route_graph_analysis(source, dest, max_hops)
        return jsonify({
            "success": True,
            "data": analysis
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@graph_bp.route("/mst", methods=["GET"])
def mst_simulation():
    """
    GET /api/graph/mst - Minimum Spanning Tree simulation
    Query parameters:
    - source: source airport code
    - dest: destination airport code
    - algorithm: "prim" or "kruskal" (default: "prim")
    - max_states: maximum number of states to return (default: 500)
    """
    try:
        source = request.args.get("source")
        dest = request.args.get("dest")
        algorithm = request.args.get("algorithm", "prim").strip().lower()
        max_states = int(request.args.get("max_states", 500))
        
        if not source or not dest:
            return jsonify({
                "success": False,
                "error": "source and dest parameters are required"
            }), 400
        
        get_db_connection()
        
        if algorithm == "kruskal":
            result = kruskal_mst_simulate(source, dest, max_states)
        else:
            result = prim_mst_simulate(source, dest, max_states)
        
        if "error" in result:
            return jsonify({
                "success": False,
                "error": result["error"]
            }), 400
        
        return jsonify({
            "success": True,
            "algorithm": algorithm,
            "mst_edges": result["mst_edges"],
            "states": result["states"],
            "airports": result["airports"]
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

