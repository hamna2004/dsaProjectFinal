# route_calculator.py
# Optimized route finding: Dijkstra (cheapest, fastest), A* (shortest), DFS (all routes)
from ..db.connection import get_db_connection
import math
from datetime import timedelta
from flask import g
import heapq
from collections import deque
import time
import json

# called by build_route()  a_star_shortest()   multi_criteria_dijkstra
# used in the "Live Tracker" section (the /live route)
# HAVERSINE DISTANCE (KM)
# Calculates the distance (in kilometers) between two points on Earth using their latitude and longitude.

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * (math.sin(dlon / 2.0) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    return R * c


# called by many functions
# Loads airport coordinates (latitude, longitude) from the database and returns them as a dictionary.
# To calculate distances and build map visualizations
def load_airport_coords():
    cur = g.db_conn.cursor(dictionary=True)
    cur.execute("SELECT code, latitude, longitude FROM airports")
    rows = cur.fetchall()

    coords = {}
    for r in rows:
        code = (r.get("code") or "").strip().upper()
        lat = r.get("latitude")
        lon = r.get("longitude")
        if lat is None or lon is None:
            continue
        try:
            coords[code] = (float(lat), float(lon))
        except (TypeError, ValueError):
            continue

    return coords

# LOAD ALL FLIGHTS (CLEAN)
def load_all_flights():
    cur = g.db_conn.cursor(dictionary=True)

    cur.execute("""
        SELECT 
            f.id,
            f.airline,
            f.flight_no AS flight_no,
            sa.code AS `from`,
            da.code AS `to`,
            f.departure_time,
            f.arrival_time,
            f.duration,
            f.price
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id;
    """)

    flights = cur.fetchall()

    for f in flights:
        # normalize codes      " khi " → "KHI"
        if f.get("from"): f["from"] = f["from"].strip().upper()
        if f.get("to"):   f["to"] = f["to"].strip().upper()

        # duration -> minutes (remove original duration field to avoid timedelta serialization issues)
        d = f.get("duration")
        if isinstance(d, timedelta):
            f["durationMin"] = int(d.total_seconds() / 60)
        elif d is None:
            f["durationMin"] = 0
        else:
            try:
                f["durationMin"] = int(d)
            except Exception:
                f["durationMin"] = 0

        # Remove the original duration field to prevent JSON serialization errors
        if "duration" in f:
            del f["duration"]

        # price -> float
        p = f.get("price")
        try:
            f["priceUSD"] = float(p) if p is not None else 0.0
        except Exception:
            f["priceUSD"] = 0.0
    
        # Remove the original price field to avoid confusion
        if "price" in f:
            del f["price"]

        # times -> strings (JSON-safe)
        if f.get("departure_time"): f["departure_time"] = str(f["departure_time"])
        if f.get("arrival_time"):   f["arrival_time"] = str(f["arrival_time"])

    return flights

# Removes or converts non-JSON-serializable values in a flight dictionary so it can be safely sent to the frontend.
# Python objects like timedelta, datetime, or custom objects cannot be directly converted to JSON. This function cleans them.
def sanitize_flight_for_json(flight):
    """
    Creates a clean copy of a flight object, removing all non-JSON-serializable objects.
    """
    from datetime import datetime, timedelta, date
    
    clean_flight = {}
    for key, value in flight.items():
        # Skip non-serializable types
        if isinstance(value, timedelta):
            # Skip timedelta - should already be converted to durationMin
            continue
        elif isinstance(value, (datetime, date)):
            # Convert datetime/date to string
            clean_flight[key] = str(value)
        elif isinstance(value, (int, float, str, bool, type(None))):
            clean_flight[key] = value
        elif isinstance(value, dict):
            # Recursively sanitize nested dicts
            clean_flight[key] = sanitize_flight_for_json(value)
        elif isinstance(value, list):
            # Sanitize list items
            clean_list = []
            for item in value:
                if isinstance(item, timedelta):
                    continue  # Skip timedelta objects
                elif isinstance(item, (datetime, date)):
                    clean_list.append(str(item))
                elif isinstance(item, dict):
                    clean_list.append(sanitize_flight_for_json(item))
                elif isinstance(item, (int, float, str, bool, type(None))):
                    clean_list.append(item)
                else:
                    try:
                        clean_list.append(str(item))
                    except:
                        pass  # Skip if can't convert
            clean_flight[key] = clean_list
        else:
            # For any other type, try to convert to string or skip
            try:
                # Check if it's JSON serializable
                json.dumps(value)
                clean_flight[key] = value
            except (TypeError, ValueError):
                # Skip if not JSON serializable
                pass
    return clean_flight

# used by dijkstra_cheapest, dijkstra_fastest, a_star_shortest, find_routes, multi_criteria_dijkstra
# Takes a list of flights (already found) and builds a route object with total price, duration, distance, stops, and stats.
def build_route(flights, coords):
    """
    flights: list of flight dicts (legs)
    coords: dict code -> (lat, lon)
    returns JSON-serializable route object
    """
    if not flights:
        return None

    total_price = sum(f.get("priceUSD", 0.0) for f in flights)
    total_duration = sum(f.get("durationMin", 0) for f in flights)
    stops = len(flights) - 1

    total_distance = 0.0
    path_airports = []
    
    # Sanitize all flights to ensure JSON serializability
    clean_legs = []
    
    for f in flights:
        # Handle both "from"/"to" and "source_airport"/"dest_airport" formats
        from_airport = f.get("from") or (f.get("source_airport") if isinstance(f.get("source_airport"), str) else None)
        to_airport = f.get("to") or (f.get("dest_airport") if isinstance(f.get("dest_airport"), str) else None)
        
        if not from_airport or not to_airport:
            # Missing airport codes — cannot build this route
            return None
            
        o = coords.get(from_airport)
        d = coords.get(to_airport)
        if not o or not d:
            # missing coordinates for some airport — cannot build this route
            return None
        total_distance += haversine(o[0], o[1], d[0], d[1])
        path_airports.append(from_airport)
        
        # Create a clean copy of the flight for JSON serialization
        clean_flight = sanitize_flight_for_json(f)
        clean_legs.append(clean_flight)
    
    # Add the final destination
    last_flight = flights[-1]
    final_dest = last_flight.get("to") or (last_flight.get("dest_airport") if isinstance(last_flight.get("dest_airport"), str) else None)
    if final_dest:
        path_airports.append(final_dest)
    
    # Build coordinates path
    coords_path = []
    for airport in path_airports:
        if airport in coords:
            coords_path.append(coords[airport])

    return {
        "legs": clean_legs,  # Use sanitized legs
        "path": path_airports,
        "coords": coords_path,
        "totalPriceUSD": total_price,
        "totalDurationMin": total_duration,
        "totalDistanceKM": round(total_distance, 2),
        "stops": stops,
        "stats": {
            "nodes_explored": len(flights),
            "edges_checked": len(flights),
            "time_ms": 0
        }
    }

# BUILD GRAPH (adjacency lists)
def build_graph():
    """
    Returns adjacency dict: graph[src] = [flight_dict, ...]
    flight_dict contains at least keys: 'from', 'to', 'priceUSD', 'durationMin', 'flight_no', etc.
    Handles both 'from'/'to' and 'source_airport'/'dest_airport' formats.
    """
    flights = load_all_flights()
    graph = {}

    for f in flights:
        # Handle both "from"/"to" and "source_airport"/"dest_airport" formats
        src = f.get("from") or (f.get("source_airport") if isinstance(f.get("source_airport"), str) else None)
        dst = f.get("to") or (f.get("dest_airport") if isinstance(f.get("dest_airport"), str) else None)
        if not src or not dst:
            continue
        graph.setdefault(src, []).append(f)

    return graph

# DIJKSTRA GENERIC: accepts a weight accessor function
def dijkstra_generic(source, dest, weight_fn):
    """
    weight_fn(flight) -> numeric weight for that edge ( price or distance )
    Returns route object (build_route) or None
    """
    graph = build_graph()
    coords = load_airport_coords()

    # quick sanity
    if source == dest:
        return None

    # Priority queue holds (cost, node)
    pq = [(0.0, source)]
    best = {source: 0.0}
    came_from = {}      # came_from[node] = predecessor node
    flight_used = {}    # flight_used[node] = flight (edge) that led to node

    visited = set()

    while pq:
        cost, node = heapq.heappop(pq)
        if node in visited:
            continue
        visited.add(node)

        # if we've reached destination reconstruct path
        if node == dest:
            path = []
            cur = dest
            while cur in flight_used and flight_used[cur] is not None:
                path.append(flight_used[cur])
                cur = came_from[cur]
            path.reverse()
            return build_route(path, coords)

        #each node may have multiple outgoing flights
        #so we pick the best one
        for f in graph.get(node, []):
            # Handle both "from"/"to" and "source_airport"/"dest_airport" formats
            nxt = f.get("to") or (f.get("dest_airport") if isinstance(f.get("dest_airport"), str) else None)
            if not nxt:
                continue
            w = weight_fn(f)
            if w is None:
                w = 0.0
            new_cost = cost + float(w)
            if nxt not in best or new_cost < best[nxt]:
                best[nxt] = new_cost
                came_from[nxt] = node
                flight_used[nxt] = f
                heapq.heappush(pq, (new_cost, nxt))

    return None

# convenience wrappers
def dijkstra_cheapest(source, dest):
    return dijkstra_generic(source, dest, lambda e: e.get("priceUSD", 0.0))

def dijkstra_fastest(source, dest):
    return dijkstra_generic(source, dest, lambda e: e.get("durationMin", 0))

# A* (optimized) — shortest distance
def a_star_shortest(source, dest):
    graph = build_graph()
    coords = load_airport_coords()

    if source == dest:
        return None
    if source not in coords or dest not in coords:
        return None
    
    """
    A* uses f = g + h, where:
    g = distance from source to current node
    h = heuristic (estimated distance to destination)
    Initially, g = 0, h = haversine distance from source to dest
    pq → min-heap storing (f_score, node)
    """
    g_score = {source: 0.0}
    came_from = {}
    flight_used = {}

    # initial heuristic from source
    start_h = haversine(coords[source][0], coords[source][1], coords[dest][0], coords[dest][1])
    pq = [(start_h, source)]
    visited = set()

    while pq:
        fscore, current = heapq.heappop(pq)
        if current in visited:
            continue
        visited.add(current)

        if current == dest:
            # reconstruct path
            path = []
            node = dest
            while node in flight_used and flight_used[node] is not None:
                path.append(flight_used[node])
                node = came_from[node]
            path.reverse()
            return build_route(path, coords)

        for f in graph.get(current, []):
            # Handle both "from"/"to" and "source_airport"/"dest_airport" formats
            nxt = f.get("to") or (f.get("dest_airport") if isinstance(f.get("dest_airport"), str) else None)
            if not nxt or nxt not in coords:
                continue

            # step distance current -> nxt
            step = haversine(coords[current][0], coords[current][1], coords[nxt][0], coords[nxt][1])
            #tentative_g is distance from source-> neighbour via current node
            tentative_g = g_score.get(current, float('inf')) + step

            # if new path i shorter than previously known, only then we update g
            if tentative_g < g_score.get(nxt, float('inf')):
                g_score[nxt] = tentative_g
                came_from[nxt] = current
                flight_used[nxt] = f

                h = haversine(coords[nxt][0], coords[nxt][1], coords[dest][0], coords[dest][1])
                heapq.heappush(pq, (tentative_g + h, nxt))

    return None

# Route Planner Page (all routes) - DFS (brute-force)  
def find_routes(source, dest, max_stops=2):
    """
    Brute-force depth-first search enumerating all routes up to max_stops.
    Returns a list of route objects (build_route results).
    """
    flights = load_all_flights()
    coords = load_airport_coords()
    results = []

    def dfs(current, path, stops_left):
        if current == dest and len(path) > 0:
            # route found
            route = build_route(path, coords)
            if route:
                results.append(route)
            return

        if stops_left < 0:
            return

        for f in flights:
            # Check both "from" field and source_airport (could be ID or code)
            from_airport = f.get("from") or (f.get("source_airport") if isinstance(f.get("source_airport"), str) else None)
            to_airport = f.get("to") or (f.get("dest_airport") if isinstance(f.get("dest_airport"), str) else None)
            
            if from_airport == current and f not in path and to_airport:
                dfs(to_airport, path + [f], stops_left - 1)

    dfs(source, [], max_stops)
    return results

# best overall - Optimizes price, time, and distance simultaneously
def multi_criteria_dijkstra(source, dest, price_weight=0.40, time_weight=0.35, distance_weight=0.25):
    """
    Multi-criteria pathfinding algorithm that optimizes price, time, and distance simultaneously.
    Uses a composite cost function with normalized metrics.
    
    Algorithm:
    1. First pass: Compute normalization factors (min/max) for all edges
    2. Second pass: Run Dijkstra with composite cost = normalized_price*w1 + normalized_time*w2 + normalized_distance*w3
    
    Args:
        source: Source airport code
        dest: Destination airport code
        price_weight: Weight for price (default 0.40)
        time_weight: Weight for time (default 0.35)
        distance_weight: Weight for distance (default 0.25)
    
    Returns:
        Route object or None
    """
    graph = build_graph()
    coords = load_airport_coords()
    
    if source == dest:
        return None
    if source not in coords or dest not in coords:
        return None
    
    # Ensure weights sum to 1.0
    total_weight = price_weight + time_weight + distance_weight
    if total_weight > 0:
        price_weight /= total_weight
        time_weight /= total_weight
        distance_weight /= total_weight
    else:
        price_weight = time_weight = distance_weight = 1.0 / 3.0
    
    # FIRST PASS: Compute normalization factors
    all_prices = []
    all_times = []
    all_distances = []
    
    for node in graph:
        for edge in graph[node]:
            price = edge.get("priceUSD", 0.0)
            time = edge.get("durationMin", 0)
            # Handle both "from"/"to" and "source_airport"/"dest_airport" formats
            from_code = edge.get("from") or (edge.get("source_airport") if isinstance(edge.get("source_airport"), str) else None)
            to_code = edge.get("to") or (edge.get("dest_airport") if isinstance(edge.get("dest_airport"), str) else None)
            
            if from_code and to_code and from_code in coords and to_code in coords:
                distance = haversine(
                    coords[from_code][0], coords[from_code][1],
                    coords[to_code][0], coords[to_code][1]
                )
                all_prices.append(price)
                all_times.append(time)
                all_distances.append(distance)
    
    # Compute min/max for normalization
    if not all_prices or not all_times or not all_distances:
        return None
    
    min_price, max_price = min(all_prices), max(all_prices)
    min_time, max_time = min(all_times), max(all_times)
    min_distance, max_distance = min(all_distances), max(all_distances)
    
    # Avoid division by zero
    price_range = max_price - min_price if max_price > min_price else 1.0
    time_range = max_time - min_time if max_time > min_time else 1.0
    distance_range = max_distance - min_distance if max_distance > min_distance else 1.0
    
    # SECOND PASS: Run Dijkstra with composite cost
    def composite_weight(edge):
        """
        Compute composite weight for an edge.
        Normalizes each metric to 0-1 scale and applies weights.
        """
        price = edge.get("priceUSD", 0.0)
        time = edge.get("durationMin", 0)
        # Handle both "from"/"to" and "source_airport"/"dest_airport" formats
        from_code = edge.get("from") or (edge.get("source_airport") if isinstance(edge.get("source_airport"), str) else None)
        to_code = edge.get("to") or (edge.get("dest_airport") if isinstance(edge.get("dest_airport"), str) else None)
        
        if not from_code or not to_code or from_code not in coords or to_code not in coords:
            return float('inf')
        
        distance = haversine(
            coords[from_code][0], coords[from_code][1],
            coords[to_code][0], coords[to_code][1]
        )
        
        # Normalize each metric (0-1 scale, lower is better)
        norm_price = (price - min_price) / price_range
        norm_time = (time - min_time) / time_range
        norm_distance = (distance - min_distance) / distance_range
        
        # Composite cost
        composite = (norm_price * price_weight) + (norm_time * time_weight) + (norm_distance * distance_weight)
        
        return composite
    
    # Run Dijkstra with composite weight function
    pq = [(0.0, source)]
    best = {source: 0.0}
    came_from = {}
    flight_used = {}
    visited = set()
    
    while pq:
        cost, node = heapq.heappop(pq)
        if node in visited:
            continue
        visited.add(node)
        
        if node == dest:
            # Reconstruct path
            path = []
            cur = dest
            while cur in flight_used and flight_used[cur] is not None:
                path.append(flight_used[cur])
                cur = came_from[cur]
            path.reverse()
            return build_route(path, coords)
        
        for edge in graph.get(node, []):
            # Handle both "from"/"to" and "source_airport"/"dest_airport" formats
            nxt = edge.get("to") or (edge.get("dest_airport") if isinstance(edge.get("dest_airport"), str) else None)
            if not nxt:
                continue
            
            w = composite_weight(edge)
            if w == float('inf'):
                continue
            
            new_cost = cost + w
            if nxt not in best or new_cost < best[nxt]:
                best[nxt] = new_cost
                came_from[nxt] = node
                flight_used[nxt] = edge
                heapq.heappush(pq, (new_cost, nxt))
    
    return None

# PARETO OPTIMAL ROUTES - Find all non-dominated routes
def find_pareto_optimal_routes(source, dest):
    """
    Find all Pareto optimal routes using multiple algorithms.
    
    Pareto Optimal: A route is Pareto optimal if no other route is better
    in ALL criteria (price, time, distance) simultaneously.
    
    Algorithm:
    1. Run cheapest, fastest, shortest algorithms to get candidate routes
    2. Optionally generate more candidates (e.g., K-shortest paths)
    3. Filter to Pareto front (remove dominated routes)
    4. Return all non-dominated routes
    
    Returns:
    {
        "pareto_routes": [route1, route2, ...],  # All Pareto optimal routes
        "total_candidates": int,  # Total routes found before filtering
        "pareto_count": int  # Number of Pareto optimal routes
    }
    """
    graph = build_graph()
    coords = load_airport_coords()
    
    if source == dest:
        return {"pareto_routes": [], "total_candidates": 0, "pareto_count": 0}
    
    # Step 1: Find ALL candidate routes using DFS (to see dominated routes)
    candidates = []
    candidate_set = set()  # To avoid duplicates (by path)
    
    # Helper function to create route key
    def get_route_key(route):
        if not route or not route.get("legs"):
            return None
        try:
            # Create key from path (airport codes) - more reliable than legs
            if route.get("path") and len(route.get("path", [])) > 0:
                return tuple(route.get("path", []))
            # Fallback to legs - check both "from"/"to" and source_airport/dest_airport
            leg_path = []
            for leg in route.get("legs", []):
                from_airport = leg.get("from") or leg.get("source_airport") or (leg.get("source_airport", {}).get("code") if isinstance(leg.get("source_airport"), dict) else None)
                to_airport = leg.get("to") or leg.get("dest_airport") or (leg.get("dest_airport", {}).get("code") if isinstance(leg.get("dest_airport"), dict) else None)
                if from_airport and to_airport:
                    leg_path.append(f"{from_airport}->{to_airport}")
            if leg_path:
                return tuple(leg_path)
            return None
        except Exception:
            return None
    
    # Find ALL routes using DFS (up to 4 stops to get all possible routes)
    try:
        all_routes = find_routes(source, dest, max_stops=4)
        
        # Add all routes from DFS
        for route in all_routes:
            if route and route.get("legs") and len(route.get("legs", [])) > 0:
                path_key = get_route_key(route)
                if path_key and path_key not in candidate_set:
                    candidate_set.add(path_key)
                    candidates.append(route)
        
    except Exception:
        # If DFS fails, fall back to just algorithm results
        try:
            cheapest_route = dijkstra_cheapest(source, dest)
            fastest_route = dijkstra_fastest(source, dest)
            shortest_route = a_star_shortest(source, dest)
            
            for route in [cheapest_route, fastest_route, shortest_route]:
                if route and route.get("legs") and len(route.get("legs", [])) > 0:
                    path_key = get_route_key(route)
                    if path_key and path_key not in candidate_set:
                        candidate_set.add(path_key)
                        candidates.append(route)
        except:
            return {
                "pareto_routes": [],
                "total_candidates": 0,
                "pareto_count": 0,
                "error": str(e) if 'e' in locals() else "Failed to find routes"
            }
    
    # Ensure we have candidates
    if len(candidates) == 0:
        return {
            "pareto_routes": [],
            "all_candidates": [],
            "total_candidates": 0,
            "pareto_count": 0,
            "error": "No routes found"
        }
    
    # Step 2: Filter to Pareto optimal routes
    pareto_routes = []
    
    for route in candidates:
        is_dominated = False
        
        # Check if this route is dominated by any other route
        for other_route in candidates:
            if route == other_route:
                continue
            
            # Check if other_route dominates route
            if dominates(other_route, route):
                is_dominated = True
                break
        
        if not is_dominated:
            pareto_routes.append(route)
    
    # Step 3: Return Pareto optimal routes based on actual dominance
    # - If 1 route dominates all: return 1
    # - If 2-3 routes are non-dominated: return all (2-3)
    # - If more than 3 routes are non-dominated: select best 3 (cheapest, fastest, shortest)
    final_pareto_routes = []
    
    if len(pareto_routes) == 0:
        # No Pareto routes found, return empty
        final_pareto_routes = []
    elif len(pareto_routes) == 1:
        # Only 1 Pareto optimal route (it dominates all others), return just that 1
        final_pareto_routes = pareto_routes
    elif len(pareto_routes) <= 3:
        # 2-3 routes are Pareto optimal (none dominate each other), return all of them
        final_pareto_routes = pareto_routes
    else:
        # More than 3 Pareto routes, select the best 3:
        # 1. Cheapest route
        # 2. Fastest route  
        # 3. Shortest route (by distance)
        
        cheapest_route = None
        fastest_route = None
        shortest_route = None
        
        min_price = float('inf')
        min_time = float('inf')
        min_distance = float('inf')
        
        for route in pareto_routes:
            price = route.get("totalPriceUSD") or route.get("total_cost", float('inf'))
            time = route.get("totalDurationMin") or route.get("total_duration", float('inf'))
            distance = route.get("totalDistanceKM") or route.get("total_distance", float('inf'))
            
            # Find cheapest
            if price < min_price:
                min_price = price
                cheapest_route = route
            
            # Find fastest
            if time < min_time:
                min_time = time
                fastest_route = route
            
            # Find shortest
            if distance < min_distance:
                min_distance = distance
                shortest_route = route
        
        # Add unique routes (avoid duplicates)
        route_set = set()
        for route in [cheapest_route, fastest_route, shortest_route]:
            if route is not None:
                route_key = get_route_key(route)
                if route_key and route_key not in route_set:
                    route_set.add(route_key)
                    final_pareto_routes.append(route)
        
        # If we have fewer than 3 (due to duplicates), add more from pareto_routes
        if len(final_pareto_routes) < 3:
            for route in pareto_routes:
                if len(final_pareto_routes) >= 3:
                    break
                route_key = get_route_key(route)
                if route_key and route_key not in route_set:
                    route_set.add(route_key)
                    final_pareto_routes.append(route)
    
    # Make sure we're returning all candidates - create a copy to avoid any issues
    all_candidates_list = list(candidates)  # Create explicit copy
    
    return {
        "pareto_routes": final_pareto_routes,  # Pareto optimal routes (1-3 routes)
        "all_candidates": all_candidates_list,  # ALL routes found by DFS (including dominated ones) for visualization
        "total_candidates": len(all_candidates_list),
        "pareto_count": len(final_pareto_routes)
    }


def dominates(route1, route2):
    """
    Check if route1 dominates route2.
    
    route1 dominates route2 if:
    - route1 is better or equal in ALL criteria (price, time, distance)
    - route1 is strictly better in AT LEAST ONE criterion
    
    Returns: True if route1 dominates route2, False otherwise
    """
    if not route1 or not route2:
        return False
    
    # Get metrics (handle missing values - check both naming conventions)
    r1_price = route1.get("totalPriceUSD") or route1.get("total_cost", float('inf'))
    r1_time = route1.get("totalDurationMin") or route1.get("total_duration", float('inf'))
    r1_dist = route1.get("totalDistanceKM") or route1.get("total_distance", float('inf'))
    
    r2_price = route2.get("totalPriceUSD") or route2.get("total_cost", float('inf'))
    r2_time = route2.get("totalDurationMin") or route2.get("total_duration", float('inf'))
    r2_dist = route2.get("totalDistanceKM") or route2.get("total_distance", float('inf'))
    
    # Check if route1 is better or equal in all criteria
    better_or_equal_price = r1_price <= r2_price
    better_or_equal_time = r1_time <= r2_time
    better_or_equal_dist = r1_dist <= r2_dist
    
    all_better_or_equal = better_or_equal_price and better_or_equal_time and better_or_equal_dist
    
    # Check if route1 is strictly better in at least one criterion
    strictly_better_price = r1_price < r2_price
    strictly_better_time = r1_time < r2_time
    strictly_better_dist = r1_dist < r2_dist
    
    at_least_one_strictly_better = strictly_better_price or strictly_better_time or strictly_better_dist
    
    return all_better_or_equal and at_least_one_strictly_better

# ---------------------------------------------------------
# COMPARE ALL ALGORITHMS - Run all and return results
# ---------------------------------------------------------
def compare_all_algorithms(source, dest):
    """
    Runs all three algorithms (cheapest, fastest, shortest) and returns their results.
    Useful for comparing which algorithm gives the best overall route.
    
    Returns:
    {
        "cheapest": route_obj or None,
        "fastest": route_obj or None,
        "shortest": route_obj or None,
        "best_overall": route_obj or None,  # Best based on normalized scoring
        "algorithm_used": "cheapest" | "fastest" | "shortest"
    }
    """
    cheapest_route = dijkstra_cheapest(source, dest)
    fastest_route = dijkstra_fastest(source, dest)
    shortest_route = a_star_shortest(source, dest)
    
    # Find best overall using normalized scoring
    # Normalize each metric (0-1 scale) and combine
    routes = [r for r in [cheapest_route, fastest_route, shortest_route] if r is not None]
    
    if not routes:
        return {
            "cheapest": cheapest_route,
            "fastest": fastest_route,
            "shortest": shortest_route,
            "best_overall": None,
            "algorithm_used": None
        }
    
    # Get min/max for normalization
    prices = [r.get("totalPriceUSD", 0) for r in routes]
    durations = [r.get("totalDurationMin", 0) for r in routes]
    distances = [r.get("totalDistanceKM", 0) for r in routes]
    
    min_price, max_price = (min(prices), max(prices)) if prices else (0, 1)
    min_duration, max_duration = (min(durations), max(durations)) if durations else (0, 1)
    min_distance, max_distance = (min(distances), max(distances)) if distances else (0, 1)
    
    # Normalize and score (lower is better for all metrics)
    best_score = float('inf')
    best_route = None
    best_algorithm = None
    
    for route in routes:
        # Normalize to 0-1 (lower is better)
        norm_price = (route.get("totalPriceUSD", 0) - min_price) / (max_price - min_price) if max_price > min_price else 0.5
        norm_duration = (route.get("totalDurationMin", 0) - min_duration) / (max_duration - min_duration) if max_duration > min_duration else 0.5
        norm_distance = (route.get("totalDistanceKM", 0) - min_distance) / (max_distance - min_distance) if max_distance > min_distance else 0.5
        
        # Weighted combination (equal weights: price 40%, time 35%, distance 25%)
        score = (norm_price * 0.4) + (norm_duration * 0.35) + (norm_distance * 0.25)
        
        if score < best_score:
            best_score = score
            best_route = route
            # Determine which algorithm found this route
            if route == cheapest_route:
                best_algorithm = "cheapest"
            elif route == fastest_route:
                best_algorithm = "fastest"
            elif route == shortest_route:
                best_algorithm = "shortest"
    
    return {
        "cheapest": cheapest_route,
        "fastest": fastest_route,
        "shortest": shortest_route,
        "best_overall": best_route,
        "algorithm_used": best_algorithm,
        "scores": {
            "cheapest_score": best_score if cheapest_route == best_route else None,
            "fastest_score": best_score if fastest_route == best_route else None,
            "shortest_score": best_score if shortest_route == best_route else None
        }
    }

# ---------------------------------------------------------
# MAIN PICKER: find_optimal_route uses optimized algorithms depending on mode
# ---------------------------------------------------------
def find_optimal_route(source, dest, max_stops=2, mode="cheapest"):
    """
    mode: 'cheapest' | 'fastest' | 'shortest' | 'best_overall' | anything else falls back to DFS (all)
    This preserves the existing function signature so route_planner.py does not change.
    
    'best_overall': Runs all algorithms and picks the best using normalized scoring
    """
    if not source or not dest:
        return None

    source = source.strip().upper()
    dest = dest.strip().upper()
    mode = (mode or "cheapest").strip().lower()

    # Ensure DB connected (no-op if already connected)
    try:
        get_db_connection()
    except Exception:
        pass

    if mode == "cheapest":
        return dijkstra_cheapest(source, dest)

    if mode == "fastest":
        return dijkstra_fastest(source, dest)

    if mode == "shortest":
        return a_star_shortest(source, dest)
    
    if mode == "best_overall":
        # Use proper multi-criteria Dijkstra algorithm
        return multi_criteria_dijkstra(source, dest)

    # fallback: return DFS enumeration limited by max_stops
    return find_routes(source, dest, max_stops=max_stops)
# --- add these imports at top of route_calculator.py ---

# (heapq and other imports already present in your file)

# ---------------------------------------------------------
# DIJKSTRA SIMULATION (record states: pq, distances, visited, relaxing edge)
# ---------------------------------------------------------
def dijkstra_simulate(source, dest, weight_fn, max_states=300):
    """
    Simulate Dijkstra and return:
      { "route": <route_obj or None>, "states": [state, ...] }

    state = {
      "step": int,
      "time_ms": float,
      "current": "KHI",               # popped node
      "pq": [["KHI", 0.0], ...],     # snapshot of pq contents (node, cost)
      "distances": {"KHI": 0.0, ...},
      "visited": ["KHI","LHE",...],
      "relax": { "edge": {"from": "...","to":"...","flight_no":"..."},
                 "updated": true|false,
                 "new_cost": 123.4
               }
    }
    """
    graph = build_graph()
    coords = load_airport_coords()

    # quick checks
    source = source.strip().upper(); dest = dest.strip().upper()
    if source == dest or source not in graph:
        return {"route": None, "states": []}

    start_ts = time.perf_counter()

    # PQ items: (cost, node)
    pq = [(0.0, source)]
    best = {source: 0.0}
    came_from = {}
    flight_used = {}
    visited = set()

    states = []
    step = 0

    # helper to snapshot pq as sorted list (shallow copy)
    def pq_snapshot(pq_heap):
        # pq is heap; we want sorted list by cost
        return sorted([(node, cost) for cost, node in pq_heap], key=lambda x: x[1])

    # record initial state
    states.append({
        "step": step,
        "time_ms": (time.perf_counter() - start_ts) * 1000,
        "current": None,
        "pq": pq_snapshot(pq),
        "distances": dict(best),
        "visited": list(visited),
        "came_from": dict(came_from),  # Include parent pointers for visualization
        "relax": None
    })
    step += 1

    while pq and len(states) < max_states:
        cost, node = heapq.heappop(pq)
        if node in visited:
            # capture the skip as a state
            states.append({
                "step": step,
                "time_ms": (time.perf_counter() - start_ts) * 1000,
                "current": node,
                "pq": pq_snapshot(pq),
                "distances": dict(best),
                "visited": list(visited),
                "came_from": dict(came_from),  # Include parent pointers for visualization
                "relax": {"edge": None, "updated": False, "new_cost": None, "note": "skipped_visited"}
            })
            step += 1
            continue

        visited.add(node)

        # snapshot after pop
        states.append({
            "step": step,
            "time_ms": (time.perf_counter() - start_ts) * 1000,
            "current": node,
            "pq": pq_snapshot(pq),
            "distances": dict(best),
            "visited": list(visited),
            "came_from": dict(came_from),  # Include parent pointers for visualization
            "relax": None
        })
        step += 1
        if len(states) >= max_states:
            break

        # if reached destination, reconstruct route and add final state with route
        if node == dest:
            path = []
            cur = dest
            while cur in flight_used and flight_used[cur] is not None:
                path.append(flight_used[cur])
                cur = came_from[cur]
            path.reverse()
            route = build_route(path, coords)
            
            # Add final state with route information
            final_state = {
                "step": step,
                "time_ms": (time.perf_counter() - start_ts) * 1000,
                "current": node,
                "pq": pq_snapshot(pq),
                "distances": dict(best),
                "visited": list(visited),
                "came_from": dict(came_from),  # Include parent pointers for visualization
                "relax": None,
                "route": route  # Include route in final state
            }
            states.append(final_state)
            return {"route": route, "states": states}

        # iterate neighbors and record relax events
        for f in graph.get(node, []):
            nxt = f.get("to")
            if not nxt:
                continue

            w = weight_fn(f) or 0.0
            new_cost = best.get(node, float("inf")) + float(w)
            updated = False

            # relaxation check
            if new_cost < best.get(nxt, float("inf")):
                best[nxt] = new_cost
                came_from[nxt] = node
                flight_used[nxt] = f
                heapq.heappush(pq, (new_cost, nxt))
                updated = True

            # push a state for this relaxation
            relax_state = {
                "edge": {"from": node, "to": nxt, "flight_no": f.get("flight_no")},
                "updated": updated,
                "new_cost": new_cost if updated else None
            }

            states.append({
                "step": step,
                "time_ms": (time.perf_counter() - start_ts) * 1000,
                "current": node,
                "pq": pq_snapshot(pq),
                "distances": dict(best),
                "visited": list(visited),
                "came_from": dict(came_from),  # Include parent pointers for visualization
                "relax": relax_state
            })
            step += 1
            if len(states) >= max_states:
                break

        if len(states) >= max_states:
            break

    # finished loop (no route found or max_states reached)
    # try to reconstruct if dest reached
    if dest in flight_used:
        path = []
        cur = dest
        while cur in flight_used and flight_used[cur] is not None:
            path.append(flight_used[cur])
            cur = came_from[cur]
        path.reverse()
        route = build_route(path, coords)
        
        # Add final state with route if we haven't already (in case we exited due to max_states)
        if len(states) == 0 or states[-1].get("route") is None:
            final_state = {
                "step": step,
                "time_ms": (time.perf_counter() - start_ts) * 1000,
                "current": dest if dest in visited else None,
                "pq": pq_snapshot(pq),
                "distances": dict(best),
                "visited": list(visited),
                "came_from": dict(came_from),  # Include parent pointers for visualization
                "relax": None,
                "route": route  # Include route in final state
            }
            states.append(final_state)
    else:
        route = None

    return {"route": route, "states": states}

# ---------------------------------------------------------
# ARRAY-BASED DIJKSTRA (O(V²)) - For performance comparison
# ---------------------------------------------------------
def dijkstra_array_based(source, dest, weight_fn):
    """
    Array-based Dijkstra implementation (O(V²) time complexity).
    Uses a simple array to find minimum unvisited node each iteration.
    
    This is slower than heap-based but simpler to understand.
    Used for educational comparison with heap-based Dijkstra.
    """
    graph = build_graph()
    coords = load_airport_coords()
    
    if source == dest:
        return None
    
    # Track performance metrics
    operations = {
        "extract_min_ops": 0,  # Number of times we search for minimum
        "relax_ops": 0,        # Number of edge relaxations
        "comparisons": 0       # Number of comparisons made
    }
    
    # Initialize distances: all nodes have infinite distance except source
    distances = {}
    unvisited = set()
    
    # Get all nodes from graph
    for node in graph:
        distances[node] = float('inf')
        unvisited.add(node)
    
    distances[source] = 0.0
    came_from = {}
    flight_used = {}
    
    while unvisited:
        # Find unvisited node with minimum distance (O(V) operation)
        min_node = None
        min_dist = float('inf')

        #Array-based: scan all unvisited nodes to find the minimum → O(V) per iteration
        #Heap-based: pop from a min-heap → O(log V) per iteration

        for node in unvisited:
            operations["comparisons"] += 1
            if distances[node] < min_dist:
                min_dist = distances[node]
                min_node = node
        
        operations["extract_min_ops"] += 1
        
        if min_node is None or min_dist == float('inf'):
            break
        
        unvisited.remove(min_node)
        
        # If we reached destination, reconstruct path
        if min_node == dest:
            path = []
            cur = dest
            while cur in flight_used and flight_used[cur] is not None:
                path.append(flight_used[cur])
                cur = came_from[cur]
            path.reverse()
            route = build_route(path, coords)
            if route:
                route["performance_metrics"] = operations
            return route
        
        # Relax all neighbors
        for f in graph.get(min_node, []):
            nxt = f.get("to")
            if not nxt or nxt not in unvisited:
                continue
            
            w = weight_fn(f)
            if w is None:
                w = 0.0
            new_cost = distances[min_node] + float(w)
            
            operations["relax_ops"] += 1
            operations["comparisons"] += 1
            
            if new_cost < distances[nxt]:
                distances[nxt] = new_cost
                came_from[nxt] = min_node
                flight_used[nxt] = f
    
    return None

# ---------------------------------------------------------
# PERFORMANCE COMPARISON: Array vs Heap Dijkstra
# ---------------------------------------------------------
def compare_dijkstra_implementations(source, dest, weight_fn):
    """
    Compare array-based (O(V²)) vs heap-based (O(E log V)) Dijkstra implementations.
    
    Returns:
    {
        "array_based": {
            "route": route_obj or None,
            "execution_time_ms": float,
            "operations": {...},
            "vertices": int,
            "edges": int
        },
        "heap_based": {
            "route": route_obj or None,
            "execution_time_ms": float,
            "operations": {...},
            "vertices": int,
            "edges": int
        },
        "comparison": {
            "speedup": float,  # How many times faster heap is
            "time_complexity_array": "O(V²)",
            "time_complexity_heap": "O((V + E) log V)"
        }
    }
    """
    graph = build_graph()
    
    # Count vertices and edges
    vertices = len(graph)
    edges = sum(len(graph[node]) for node in graph)
    
    # Test Array-Based Dijkstra
    start_time = time.perf_counter()
    array_route = dijkstra_array_based(source, dest, weight_fn)
    array_time = (time.perf_counter() - start_time) * 1000  # Convert to ms
    
    array_ops = array_route.get("performance_metrics", {}) if array_route else {
        "extract_min_ops": 0,
        "relax_ops": 0,
        "comparisons": 0
    }
    
    # Test Heap-Based Dijkstra
    start_time = time.perf_counter()
    heap_route = dijkstra_generic(source, dest, weight_fn)
    heap_time = (time.perf_counter() - start_time) * 1000  # Convert to ms
    
    # Estimate heap operations (heappop and heappush)
    heap_ops = {
        "extract_min_ops": len(heap_route.get("path", [])) if heap_route else 0,
        "relax_ops": edges,  # Approximate
        "heap_operations": edges * 2  # Each edge might cause heap insert
    }
    
    # Calculate speedup
    speedup = array_time / heap_time if heap_time > 0 else 0
    
    return {
        "array_based": {
            "route": array_route,
            "execution_time_ms": array_time,
            "operations": array_ops,
            "vertices": vertices,
            "edges": edges,
            "found_path": array_route is not None
        },
        "heap_based": {
            "route": heap_route,
            "execution_time_ms": heap_time,
            "operations": heap_ops,
            "vertices": vertices,
            "edges": edges,
            "found_path": heap_route is not None
        },
        "comparison": {
            "speedup": speedup,
            "time_complexity_array": "O(V²)",
            "time_complexity_heap": "O((V + E) log V)",
            "space_complexity_array": "O(V)",
            "space_complexity_heap": "O(V + E)"
        }
    }
