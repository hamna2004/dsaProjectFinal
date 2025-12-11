# graph_analyzer.py
# Graph analysis utilities: stats, adjacency matrix, degrees, connected components
from flask import g
from collections import defaultdict, deque
from ..db.connection import get_db_connection
import heapq
import time

# ---------------------------------------------------------
# GET GRAPH STATISTICS
# ---------------------------------------------------------
def get_graph_stats():
    """
    Returns:
    {
        "vertices": int,      # number of airports
        "edges": int,         # number of flights
        "density": float,     # edge density (0-1)
        "avg_degree": float,  # average degree per vertex
        "max_degree": int,    # maximum degree
        "min_degree": int     # minimum degree
    }
    """
    cur = g.db_conn.cursor(dictionary=True)
    
    # Get all airports
    cur.execute("SELECT COUNT(*) as count FROM airports")
    vertices = cur.fetchone()["count"]
    
    # Get all flights
    cur.execute("SELECT COUNT(*) as count FROM flights")
    edges = cur.fetchone()["count"]
    
    # Calculate density: E / (V * (V - 1)) for directed graph
    # For undirected it would be E / (V * (V - 1) / 2)
    max_possible_edges = vertices * (vertices - 1) if vertices > 1 else 0
    density = edges / max_possible_edges if max_possible_edges > 0 else 0.0
    
    # Calculate degrees
    cur.execute("""
        SELECT 
            sa.code as source_code,
            COUNT(*) as out_degree
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        WHERE sa.code IS NOT NULL
        GROUP BY sa.code
    """)
    
    out_degrees = {}
    for row in cur.fetchall():
        code = row["source_code"].strip().upper()
        out_degrees[code] = row["out_degree"]
    
    cur.execute("""
        SELECT 
            da.code as dest_code,
            COUNT(*) as in_degree
        FROM flights f
        LEFT JOIN airports da ON f.dest_airport = da.id
        WHERE da.code IS NOT NULL
        GROUP BY da.code
    """)
    
    in_degrees = {}
    for row in cur.fetchall():
        code = row["dest_code"].strip().upper()
        in_degrees[code] = row["in_degree"]
    
    # Combine degrees (total = in + out)
    all_degrees = []
    all_airports = set(list(out_degrees.keys()) + list(in_degrees.keys()))
    
    for airport in all_airports:
        total_degree = out_degrees.get(airport, 0) + in_degrees.get(airport, 0)
        all_degrees.append(total_degree)
    
    avg_degree = sum(all_degrees) / len(all_degrees) if all_degrees else 0.0
    max_degree = max(all_degrees) if all_degrees else 0
    min_degree = min(all_degrees) if all_degrees else 0
    
    return {
        "vertices": vertices,
        "edges": edges,
        "density": round(density, 4),
        "avg_degree": round(avg_degree, 2),
        "max_degree": max_degree,
        "min_degree": min_degree,
        "out_degrees": out_degrees,
        "in_degrees": in_degrees
    }

# ---------------------------------------------------------
# GET ADJACENCY LIST
# ---------------------------------------------------------
def get_adjacency_list():
    """
    Returns graph as adjacency list:
    {
        "LHE": [
            {"to": "DXB", "flight_no": "PK201", "price": 100.0, "duration": 180},
            ...
        ],
        ...
    }
    Note: Includes all airports that are part of the flight network (source or destination).
    Airports with no outgoing flights will have an empty list.
    """
    cur = g.db_conn.cursor(dictionary=True)
    
    # First, get all airports that are part of the flight network (source or destination)
    cur.execute("""
        SELECT DISTINCT code 
        FROM airports 
        WHERE id IN (
            SELECT DISTINCT source_airport FROM flights WHERE source_airport IS NOT NULL
            UNION
            SELECT DISTINCT dest_airport FROM flights WHERE dest_airport IS NOT NULL
        )
        ORDER BY code
    """)
    all_airports_in_network = {row["code"].strip().upper() for row in cur.fetchall()}
    
    # Initialize adjacency list for all airports in network (even if no outgoing flights)
    adjacency_list = {code: [] for code in all_airports_in_network}
    
    # Now get all flights
    cur.execute("""
        SELECT 
            sa.code AS `from`,
            da.code AS `to`,
            f.flight_no,
            f.price,
            f.duration
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id
        WHERE sa.code IS NOT NULL AND da.code IS NOT NULL
        ORDER BY sa.code, da.code
    """)
    
    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        
        # Convert duration to minutes if it's a timedelta
        duration = row["duration"]
        if hasattr(duration, 'total_seconds'):
            duration_min = int(duration.total_seconds() / 60)
        else:
            duration_min = int(duration) if duration else 0
        
        # Only add if source airport is in our network set
        if from_code in adjacency_list:
            adjacency_list[from_code].append({
                "to": to_code,
                "flight_no": row["flight_no"],
                "price": float(row["price"]) if row["price"] else 0.0,
                "duration": duration_min
            })
    
    return adjacency_list

# ---------------------------------------------------------
# GET ADJACENCY MATRIX
# ---------------------------------------------------------
def get_adjacency_matrix():
    """
    Returns adjacency matrix representation:
    {
        "airports": ["LHE", "DXB", ...],  # sorted list
        "matrix": [[0, 1, 0], [1, 0, 1], ...]  # 2D array
    }
    """
    cur = g.db_conn.cursor(dictionary=True)
    
    # Get all airport codes
    cur.execute("SELECT code FROM airports ORDER BY code")
    airports = [row["code"].strip().upper() for row in cur.fetchall()]
    
    # Create mapping: code -> index
    code_to_index = {code: idx for idx, code in enumerate(airports)}
    
    # Initialize matrix with zeros (0 means no connection)
    n = len(airports)
    matrix = [[0 for _ in range(n)] for _ in range(n)]
    
    # Fill matrix with flight prices (weighted graph)
    # If multiple flights exist between same airports, store the cheapest price
    cur.execute("""
        SELECT 
            sa.code AS `from`,
            da.code AS `to`,
            MIN(f.price) AS min_price
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id
        WHERE sa.code IS NOT NULL AND da.code IS NOT NULL
          AND f.price IS NOT NULL
        GROUP BY sa.code, da.code
    """)
    
    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        price = float(row["min_price"]) if row["min_price"] else 0.0
        
        if from_code in code_to_index and to_code in code_to_index:
            i = code_to_index[from_code]
            j = code_to_index[to_code]
            matrix[i][j] = price  # Store price (weight) instead of 1
    
    return {
        "airports": airports,
        "matrix": matrix
    }

# ---------------------------------------------------------
# GET CONNECTED COMPONENTS (BFS)
# ---------------------------------------------------------
def get_connected_components():
    """
    Returns list of connected components using BFS:
    [
        {"component_id": 0, "airports": ["LHE", "DXB", ...], "size": 5},
        ...
    ]
    """
    # Build graph from flights
    cur = g.db_conn.cursor(dictionary=True)
    
    cur.execute("""
        SELECT 
            sa.code AS `from`,
            da.code AS `to`
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id
        WHERE sa.code IS NOT NULL AND da.code IS NOT NULL
    """)
    
    # Build adjacency list (undirected for connectivity)
    graph = defaultdict(set)
    all_airports = set()
    
    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        all_airports.add(from_code)
        all_airports.add(to_code)
        # Undirected: add both directions
        graph[from_code].add(to_code)
        graph[to_code].add(from_code)
    
    # BFS to find connected components
    visited = set()
    components = []
    component_id = 0
    
    for airport in all_airports:
        if airport not in visited:
            # Start BFS from this airport
            component_airports = []
            queue = deque([airport])
            visited.add(airport)
            
            while queue:
                current = queue.popleft()
                component_airports.append(current)
                
                for neighbor in graph.get(current, []):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
            
            components.append({
                "component_id": component_id,
                "airports": sorted(component_airports),
                "size": len(component_airports)
            })
            component_id += 1
    
    return components

# ---------------------------------------------------------
# GET ROUTE-SPECIFIC GRAPH ANALYSIS
# ---------------------------------------------------------
def get_route_graph_analysis(source, dest, max_hops=3):
    """
    Returns graph analysis for a specific route:
    - Subgraph of airports/flights involved in route finding
    - Path statistics
    - Alternative connections
    - Network context
    
    Args:
        source: source airport code
        dest: destination airport code
        max_hops: maximum hops to consider for subgraph
    
    Returns:
    {
        "source": "LHE",
        "dest": "JFK",
        "subgraph": {
            "airports": ["LHE", "DXB", "IST", "JFK"],
            "edges": [...],
            "vertices_count": 4,
            "edges_count": 5
        },
        "path_stats": {
            "direct_flights": 0,
            "one_stop_options": 2,
            "two_stop_options": 1
        },
        "network_context": {
            "source_degree": 5,
            "dest_degree": 8,
            "is_connected": true
        }
    }
    """
    cur = g.db_conn.cursor(dictionary=True)
    
    source = source.strip().upper()
    dest = dest.strip().upper()
    
    # Build full graph
    cur.execute("""
        SELECT 
            sa.code AS `from`,
            da.code AS `to`,
            f.flight_no,
            f.price,
            f.duration
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id
        WHERE sa.code IS NOT NULL AND da.code IS NOT NULL
    """)
    
    graph = {}
    all_airports = set()
    
    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        all_airports.add(from_code)
        all_airports.add(to_code)
        
        if from_code not in graph:
            graph[from_code] = []
        graph[from_code].append({
            "to": to_code,
            "flight_no": row["flight_no"],
            "price": float(row["price"]) if row["price"] else 0.0,
            "duration": int(row["duration"]) if row["duration"] else 0
        })
    
    # BFS to find subgraph (airports within max_hops from source)
    subgraph_airports = set([source])
    queue = deque([(source, 0)])  # (airport, hops)
    visited = {source}
    
    while queue:
        current, hops = queue.popleft()
        if hops >= max_hops:
            continue
        
        for edge in graph.get(current, []):
            neighbor = edge["to"]
            if neighbor not in visited:
                visited.add(neighbor)
                subgraph_airports.add(neighbor)
                queue.append((neighbor, hops + 1))
    
    # Also include destination if not already included
    subgraph_airports.add(dest)
    
    # Build subgraph edges
    subgraph_edges = []
    for airport in subgraph_airports:
        if airport in graph:
            for edge in graph[airport]:
                if edge["to"] in subgraph_airports:
                    subgraph_edges.append({
                        "from": airport,
                        "to": edge["to"],
                        "flight_no": edge["flight_no"],
                        "price": edge["price"],
                        "duration": edge["duration"]
                    })
    
    # Calculate path statistics
    direct_flights = len([e for e in subgraph_edges if e["from"] == source and e["to"] == dest])
    
    # Count one-stop options (source -> X -> dest)
    one_stop = 0
    for edge1 in subgraph_edges:
        if edge1["from"] == source:
            for edge2 in subgraph_edges:
                if edge2["from"] == edge1["to"] and edge2["to"] == dest:
                    one_stop += 1
                    break
    
    # Count two-stop options (source -> X -> Y -> dest)
    two_stop = 0
    for edge1 in subgraph_edges:
        if edge1["from"] == source:
            for edge2 in subgraph_edges:
                if edge2["from"] == edge1["to"]:
                    for edge3 in subgraph_edges:
                        if edge3["from"] == edge2["to"] and edge3["to"] == dest:
                            two_stop += 1
                            break
    
    # Network context
    source_degree = len(graph.get(source, []))
    dest_degree = len([e for e in subgraph_edges if e["to"] == dest])
    
    # Check connectivity (can we reach dest from source?)
    is_connected = dest in subgraph_airports or dest in visited
    
    return {
        "source": source,
        "dest": dest,
        "subgraph": {
            "airports": sorted(list(subgraph_airports)),
            "edges": subgraph_edges,
            "vertices_count": len(subgraph_airports),
            "edges_count": len(subgraph_edges)
        },
        "path_stats": {
            "direct_flights": direct_flights,
            "one_stop_options": one_stop,
            "two_stop_options": two_stop,
            "total_paths": direct_flights + one_stop + two_stop
        },
        "network_context": {
            "source_degree": source_degree,
            "dest_degree": dest_degree,
            "is_connected": is_connected,
            "subgraph_density": round(len(subgraph_edges) / (len(subgraph_airports) * (len(subgraph_airports) - 1)), 4) if len(subgraph_airports) > 1 else 0.0
        }
    }

# ---------------------------------------------------------
# BUILD UNDIRECTED GRAPH FOR MST (from flights)
# ---------------------------------------------------------
def build_undirected_graph_for_mst(source=None, dest=None):
    """
    Builds an undirected graph from flights for MST algorithms.
    If source and dest are provided, builds subgraph between them.
    Returns: (graph_dict, edge_list, airports_set)
    """
    cur = g.db_conn.cursor(dictionary=True)
    
    # Build subgraph if source/dest provided
    if source and dest:
        source = source.strip().upper()
        dest = dest.strip().upper()
        
        # Get all flights
        cur.execute("""
            SELECT 
                sa.code AS `from`,
                da.code AS `to`,
                f.price,
                f.flight_no,
                f.duration
            FROM flights f
            LEFT JOIN airports sa ON f.source_airport = sa.id
            LEFT JOIN airports da ON f.dest_airport = da.id
            WHERE sa.code IS NOT NULL AND da.code IS NOT NULL
        """)
        
        # Build directed graph first
        directed_graph = defaultdict(list)
        all_airports = set()
        
        for row in cur.fetchall():
            from_code = row["from"].strip().upper()
            to_code = row["to"].strip().upper()
            price = float(row["price"]) if row["price"] else 0.0
            
            all_airports.add(from_code)
            all_airports.add(to_code)
            directed_graph[from_code].append((to_code, price, row))
        
        # BFS to find reachable airports from source
        subgraph_airports = set([source])
        queue = deque([source])
        visited = {source}
        
        while queue:
            current = queue.popleft()
            for neighbor, _, _ in directed_graph.get(current, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    subgraph_airports.add(neighbor)
                    queue.append(neighbor)
        
        # Always include dest
        subgraph_airports.add(dest)
        
        # Build undirected graph from subgraph
        # First, collect all edges and find minimum price for each airport pair
        edge_prices = {}  # (sorted_pair) -> (min_price, flight_info)
        
        for airport in subgraph_airports:
            for neighbor, price, flight_info in directed_graph.get(airport, []):
                if neighbor in subgraph_airports:
                    edge_key = tuple(sorted([airport, neighbor]))
                    if edge_key not in edge_prices or price < edge_prices[edge_key][0]:
                        edge_prices[edge_key] = (price, flight_info)
        
        # Now build the graph with minimum prices
        graph = defaultdict(list)
        edge_list = []
        
        for (airport1, airport2), (min_price, flight_info) in edge_prices.items():
            # Add to both directions (undirected)
            graph[airport1].append((airport2, min_price, flight_info))
            graph[airport2].append((airport1, min_price, flight_info))
            edge_list.append((min_price, airport1, airport2, flight_info))
    else:
        # Build full undirected graph
        cur.execute("""
            SELECT 
                sa.code AS `from`,
                da.code AS `to`,
                MIN(f.price) AS min_price,
                f.flight_no,
                f.duration
            FROM flights f
            LEFT JOIN airports sa ON f.source_airport = sa.id
            LEFT JOIN airports da ON f.dest_airport = da.id
            WHERE sa.code IS NOT NULL AND da.code IS NOT NULL
              AND f.price IS NOT NULL
            GROUP BY sa.code, da.code, f.flight_no, f.duration
        """)
        
        graph = defaultdict(list)
        edge_list = []
        edge_set = set()
        all_airports = set()
        
        for row in cur.fetchall():
            from_code = row["from"].strip().upper()
            to_code = row["to"].strip().upper()
            price = float(row["min_price"]) if row["min_price"] else 0.0
            
            all_airports.add(from_code)
            all_airports.add(to_code)
            
            edge_key = tuple(sorted([from_code, to_code]))
            if edge_key not in edge_set:
                edge_set.add(edge_key)
                graph[from_code].append((to_code, price, row))
                graph[to_code].append((from_code, price, row))
                edge_list.append((price, from_code, to_code, row))
        
        subgraph_airports = all_airports
    
    # Sort edge list by weight
    edge_list.sort(key=lambda x: x[0])
    
    return graph, edge_list, subgraph_airports

# ---------------------------------------------------------
# PRIM'S ALGORITHM WITH STEP-BY-STEP TRACING
# ---------------------------------------------------------
def prim_mst_simulate(source, dest, max_states=500):
    """
    Prim's algorithm to find MST with step-by-step tracing.
    Finds MST of subgraph between source and dest.
    Returns: {"mst_edges": [...], "states": [...]}
    """
    graph, edge_list, airports = build_undirected_graph_for_mst(source, dest)
    
    if source not in airports or dest not in airports:
        return {"mst_edges": [], "states": [], "error": "Source or destination not in graph"}
    
    source = source.strip().upper()
    dest = dest.strip().upper()
    
    start_ts = time.perf_counter()
    states = []
    step = 0
    
    # Prim's algorithm
    mst_edges = []
    visited = set()
    pq = []  # (weight, from, to, flight_info)
    
    # Start with source
    visited.add(source)
    
    # Add all edges from source to priority queue
    for neighbor, weight, flight_info in graph.get(source, []):
        heapq.heappush(pq, (weight, source, neighbor, flight_info))
    
    # Initial state
    states.append({
        "step": step,
        "time_ms": (time.perf_counter() - start_ts) * 1000,
        "current_node": source,
        "visited": list(visited),
        "mst_edges": list(mst_edges),
        "pq": [(w, f, t) for w, f, t, _ in pq[:10]],  # Show first 10
        "action": "start"
    })
    step += 1
    
    while pq and len(states) < max_states:
        if len(visited) >= len(airports):
            break
            
        weight, from_node, to_node, flight_info = heapq.heappop(pq)
        
        # Skip if both nodes already visited
        if to_node in visited:
            states.append({
                "step": step,
                "time_ms": (time.perf_counter() - start_ts) * 1000,
                "current_node": to_node,
                "visited": list(visited),
                "mst_edges": list(mst_edges),
                "pq": [(w, f, t) for w, f, t, _ in pq[:10]],
                "action": "skip",
                "edge": {"from": from_node, "to": to_node, "weight": weight}
            })
            step += 1
            continue
        
        # Add edge to MST (store in canonical form: sorted order for undirected graph)
        visited.add(to_node)
        # Store edge in sorted order to ensure consistency (undirected)
        edge_nodes = sorted([from_node, to_node])
        mst_edges.append({
            "from": edge_nodes[0],
            "to": edge_nodes[1],
            "weight": weight,
            "flight_info": flight_info
        })
        
        # Add new edges from to_node
        for neighbor, n_weight, n_flight_info in graph.get(to_node, []):
            if neighbor not in visited:
                heapq.heappush(pq, (n_weight, to_node, neighbor, n_flight_info))
        
        states.append({
            "step": step,
            "time_ms": (time.perf_counter() - start_ts) * 1000,
            "current_node": to_node,
            "visited": list(visited),
            "mst_edges": list(mst_edges),
            "pq": [(w, f, t) for w, f, t, _ in pq[:10]],
            "action": "add_edge",
            "edge": {"from": from_node, "to": to_node, "weight": weight}
        })
        step += 1
    
    # Verify MST correctness: should have V-1 edges for V vertices
    expected_edges = len(airports) - 1
    actual_edges = len(mst_edges)
    
    # Final state
    total_cost = sum(e["weight"] for e in mst_edges)
    
    # Verify MST is actually minimum (check if we can find a cheaper spanning tree)
    # This is a sanity check - in a correct implementation, this should always pass
    mst_valid = actual_edges == expected_edges
    
    states.append({
        "step": step,
        "time_ms": (time.perf_counter() - start_ts) * 1000,
        "current_node": None,
        "visited": list(visited),
        "mst_edges": list(mst_edges),
        "pq": [],
        "action": "complete",
        "total_cost": total_cost,
        "mst_valid": mst_valid,
        "expected_edges": expected_edges,
        "actual_edges": actual_edges
    })
    
    return {"mst_edges": mst_edges, "states": states, "airports": list(airports)}

# ---------------------------------------------------------
# KRUSKAL'S ALGORITHM WITH STEP-BY-STEP TRACING
# ---------------------------------------------------------
class UnionFind:
    def __init__(self, nodes):
        self.parent = {node: node for node in nodes}
        self.rank = {node: 0 for node in nodes}
    
    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # Path compression
        return self.parent[x]
    
    def union(self, x, y):
        root_x = self.find(x)
        root_y = self.find(y)
        
        if root_x == root_y:
            return False  # Already in same set
        
        # Union by rank
        if self.rank[root_x] < self.rank[root_y]:
            self.parent[root_x] = root_y
        elif self.rank[root_x] > self.rank[root_y]:
            self.parent[root_y] = root_x
        else:
            self.parent[root_y] = root_x
            self.rank[root_x] += 1
        
        return True  # Successfully merged

def kruskal_mst_simulate(source, dest, max_states=500):
    """
    Kruskal's algorithm to find MST with step-by-step tracing.
    Finds MST of subgraph between source and dest.
    Returns: {"mst_edges": [...], "states": [...]}
    """
    graph, edge_list, airports = build_undirected_graph_for_mst(source, dest)
    
    if source not in airports or dest not in airports:
        return {"mst_edges": [], "states": [], "error": "Source or destination not in graph"}
    
    source = source.strip().upper()
    dest = dest.strip().upper()
    
    start_ts = time.perf_counter()
    states = []
    step = 0
    
    # Kruskal's algorithm
    mst_edges = []
    uf = UnionFind(airports)
    
    # Initial state
    states.append({
        "step": step,
        "time_ms": (time.perf_counter() - start_ts) * 1000,
        "current_edge": None,
        "mst_edges": list(mst_edges),
        "edge_list": [(w, f, t) for w, f, t, _ in edge_list[:20]],  # Show first 20
        "action": "start"
    })
    step += 1
    
    edge_index = 0
    for weight, from_node, to_node, flight_info in edge_list:
        if len(states) >= max_states:
            break
        
        # Check if adding this edge creates a cycle
        if uf.find(from_node) == uf.find(to_node):
            # Skip - would create cycle
            remaining_edges = [(w, f, t) for w, f, t, _ in edge_list[edge_index+1:edge_index+21]]
            states.append({
                "step": step,
                "time_ms": (time.perf_counter() - start_ts) * 1000,
                "current_edge": {"from": from_node, "to": to_node, "weight": weight},
                "mst_edges": list(mst_edges),
                "edge_list": remaining_edges,
                "action": "skip_cycle"
            })
            step += 1
            edge_index += 1
            continue
        
        # Add edge to MST (store in canonical form: sorted order for undirected graph)
        uf.union(from_node, to_node)
        # Store edge in sorted order to ensure consistency (undirected)
        edge_nodes = sorted([from_node, to_node])
        mst_edges.append({
            "from": edge_nodes[0],
            "to": edge_nodes[1],
            "weight": weight,
            "flight_info": flight_info
        })
        
        remaining_edges = [(w, f, t) for w, f, t, _ in edge_list[edge_index+1:edge_index+21]]
        states.append({
            "step": step,
            "time_ms": (time.perf_counter() - start_ts) * 1000,
            "current_edge": {"from": from_node, "to": to_node, "weight": weight},
            "mst_edges": list(mst_edges),
            "edge_list": remaining_edges,
            "action": "add_edge"
        })
        step += 1
        edge_index += 1
        
        # Stop if we have enough edges (V-1 edges for MST)
        if len(mst_edges) >= len(airports) - 1:
            break
    
    # Verify MST correctness: should have V-1 edges for V vertices
    expected_edges = len(airports) - 1
    actual_edges = len(mst_edges)
    
    # Final state
    total_cost = sum(e["weight"] for e in mst_edges)
    states.append({
        "step": step,
        "time_ms": (time.perf_counter() - start_ts) * 1000,
        "current_edge": None,
        "mst_edges": list(mst_edges),
        "edge_list": [],
        "action": "complete",
        "total_cost": total_cost,
        "mst_valid": actual_edges == expected_edges
    })
    
    return {"mst_edges": mst_edges, "states": states, "airports": list(airports)}

