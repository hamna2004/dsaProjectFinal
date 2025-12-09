# graph_analyzer.py
# Graph analysis utilities: stats, adjacency matrix, degrees, connected components
from flask import g
from collections import defaultdict, deque
from ..db.connection import get_db_connection

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
    """
    cur = g.db_conn.cursor(dictionary=True)
    
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
    
    adjacency_list = defaultdict(list)
    
    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        
        # Convert duration to minutes if it's a timedelta
        duration = row["duration"]
        if hasattr(duration, 'total_seconds'):
            duration_min = int(duration.total_seconds() / 60)
        else:
            duration_min = int(duration) if duration else 0
        
        adjacency_list[from_code].append({
            "to": to_code,
            "flight_no": row["flight_no"],
            "price": float(row["price"]) if row["price"] else 0.0,
            "duration": duration_min
        })
    
    return dict(adjacency_list)

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
    
    # Initialize matrix with zeros
    n = len(airports)
    matrix = [[0 for _ in range(n)] for _ in range(n)]
    
    # Fill matrix with flight connections
    cur.execute("""
        SELECT 
            sa.code AS `from`,
            da.code AS `to`
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id
        WHERE sa.code IS NOT NULL AND da.code IS NOT NULL
    """)
    
    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        
        if from_code in code_to_index and to_code in code_to_index:
            i = code_to_index[from_code]
            j = code_to_index[to_code]
            matrix[i][j] = 1  # Directed graph: 1 if flight exists
    
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

