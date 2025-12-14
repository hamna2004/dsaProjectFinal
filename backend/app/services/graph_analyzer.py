# graph_analyzer.py
# Graph analysis utilities: stats, adjacency matrix, degrees, connected components
from flask import g
from collections import defaultdict, deque
from ..db.connection import get_db_connection
import heapq
import time

"""
Vertices(nodes) -> airports 
edges -> flights 

directed graphs ( flights go from source to destination 
weighted graphs (weight could be price or distance)

this file does not do routing, it pulls data from DB , builds graph structures in memory
runs graph algorithms , returns python dictionaries ( which are later jsonifies in routes btw ) 

"""
def get_graph_stats():
    cur = g.db_conn.cursor(dictionary=True)
    
    cur.execute("SELECT COUNT(*) as count FROM airports")
    vertices = cur.fetchone()["count"]
    
    cur.execute("SELECT COUNT(*) as count FROM flights")
    edges = cur.fetchone()["count"]

    # calculates how connected the graph is (the density)
    # formula : density = edges / (v*(v-1))
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

    #out degrees - flights LEAVING an airport
    # so they are grouped by the source airport
    # GROUP BY SOURCE AIRPORT

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

    # in degree - flights ARRIVING at the airport
    # so they are grouped by the destination airport
    in_degrees = {}
    for row in cur.fetchall():
        code = row["dest_code"].strip().upper()
        in_degrees[code] = row["in_degree"]
    
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

"""
this is how adjacency lists are being stored 
{
  "LHR": [
    { "to": "JFK", "price": 500, "duration": 420 },
    { "to": "DXB", "price": 300, "duration": 380 }
  ],
  "DXB": [
    { "to": "SIN", "price": 250, "duration": 480 }
  ]
}
"""

def get_adjacency_list():
    cur = g.db_conn.cursor(dictionary=True)

    # get all airports that appear in any flight, either as a source or destination.
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

    #NOW THIS WILL CREATE A SET LIKE {"LHR", "JFK", "DXB", "SIN"}
    all_airports_in_network = {row["code"].strip().upper() for row in cur.fetchall()}

    """
    then we initialize empty adjacency list
    it will look like this 
    {
        "LHR": [],
        "JFK": [],
        "DXB": [],
        "SIN": []
    }
    """
    adjacency_list = {code: [] for code in all_airports_in_network}


    #now this query gives all the flights (and the data related to them

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
    
    for row in cur.fetchall(): #loop one flight at a time
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        
        duration = row["duration"]
        if hasattr(duration, 'total_seconds'):
            duration_min = int(duration.total_seconds() / 60)
        else:
            duration_min = int(duration) if duration else 0
        
        if from_code in adjacency_list:
            adjacency_list[from_code].append({
                "to": to_code,
                "flight_no": row["flight_no"],
                "price": float(row["price"]) if row["price"] else 0.0,
                "duration": duration_min
            })
    
    return adjacency_list

def get_adjacency_matrix():
    """
    this gives a directed adjacency matrix
    zero means no edge
    memory : o(v^2) SO IT WILL BE VERY EXPENSIVE FOR LARGE GRAPHS
    """
    cur = g.db_conn.cursor(dictionary=True)

    # get all airports even isolated ones
    cur.execute("SELECT code FROM airports ORDER BY code")
    airports = [row["code"].strip().upper() for row in cur.fetchall()]

    """
    map airport to index 
    smth like this 
    {
    "DXB": 0,
    "JFK": 1,
    "LHR": 2
    }
    """
    code_to_index = {code: idx for idx, code in enumerate(airports)}
    
    n = len(airports)
    matrix = [[0 for _ in range(n)] for _ in range(n)] #initialize empty matrix
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
    #since matrix stores only one flight (even if multiple exist)
    #we just keep the one that has min price

    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        price = float(row["min_price"]) if row["min_price"] else 0.0
        
        if from_code in code_to_index and to_code in code_to_index:
            i = code_to_index[from_code]
            j = code_to_index[to_code]
            matrix[i][j] = price
    
    return {
        "airports": airports,
        "matrix": matrix
    }

def get_connected_components():
    """
    this ignores direction, just gives which airports are connected to each other at all
    USES BFS

    returns something like this

    [
        {
            "component_id": 0,
            "airports": ["DXB", "JFK", "LHR"],
            "size": 3
        },
        {
            "component_id": 1,
            "airports": ["SIN", "SYD"],
            "size": 2
        }
    ]

    """
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

    #creates a graph with keys -> airport codes and values -> set of neighbouring airports
    graph = defaultdict(set) #using "set" avoids duplicate neighbours
    all_airports = set()
    
    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        all_airports.add(from_code)
        all_airports.add(to_code)
        graph[from_code].add(to_code) #adds edges in BOTH directions ( so direction is ignored)
        graph[to_code].add(from_code)
    
    visited = set() # keeps track of airports already explored
    components = [] # list that will store all connected components
    component_id = 0
    
    for airport in all_airports:
        if airport not in visited: #START BFS
            component_airports = []
            queue = deque([airport])
            visited.add(airport)
            
            while queue:
                current = queue.popleft()
                component_airports.append(current)
                
                for neighbor in graph.get(current, []): #iterates over all airports directly connected to current
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

def get_route_graph_analysis(source, dest, max_hops=3):
    """
    builds a directed graph and then extracts a limited subgraph using BFS again
    computes direct flights, one stop routes, two stop routes and network statistics
    """
    cur = g.db_conn.cursor(dictionary=True)
    
    source = source.strip().upper()
    dest = dest.strip().upper()
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
    
    subgraph_airports = set([source]) # starts sub graph with only source airport
    queue = deque([(source, 0)])
    # BFS QUEUE SORTING : (CURRENT AIRPORT, HOPS USED)
    # to ensure paths longer than max_hops are not expanded
    visited = {source}
    
    while queue:
        current, hops = queue.popleft()
        if hops >= max_hops: # Stops expanding paths longer than allowed hops.
            continue
        
        for edge in graph.get(current, []):
            neighbor = edge["to"]
            if neighbor not in visited:
                visited.add(neighbor)
                subgraph_airports.add(neighbor)
                queue.append((neighbor, hops + 1))
    
    subgraph_airports.add(dest)

    #this stores all edges in sub graph
    subgraph_edges = []
    for airport in subgraph_airports: #iterates over all airports in sub graph
        if airport in graph: # checks if it has outgoing flights
            for edge in graph[airport]: #iterates over them
                if edge["to"] in subgraph_airports: #if dest also in sub graph
                    subgraph_edges.append({
                        "from": airport,
                        "to": edge["to"],
                        "flight_no": edge["flight_no"],
                        "price": edge["price"],
                        "duration": edge["duration"]
                    })
    
    direct_flights = len([e for e in subgraph_edges if e["from"] == source and e["to"] == dest])
    one_stop = 0
    for edge1 in subgraph_edges:
        if edge1["from"] == source:
            for edge2 in subgraph_edges:
                if edge2["from"] == edge1["to"] and edge2["to"] == dest:
                    one_stop += 1
                    break
    
    two_stop = 0
    for edge1 in subgraph_edges:
        if edge1["from"] == source:
            for edge2 in subgraph_edges:
                if edge2["from"] == edge1["to"]:
                    for edge3 in subgraph_edges:
                        if edge3["from"] == edge2["to"] and edge3["to"] == dest:
                            two_stop += 1
                            break
    
    source_degree = len(graph.get(source, []))
    dest_degree = len([e for e in subgraph_edges if e["to"] == dest])
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

def build_undirected_graph_for_mst(source=None, dest=None):
    cur = g.db_conn.cursor(dictionary=True)

    #if source and dest are given, it builds a limited sub graph not the whole network
    #builds MST only around source-> reachable airports -> dest
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
                    edge_key = tuple(sorted([airport, neighbor])) # (A->B) and (B->A) same key
                    if edge_key not in edge_prices or price < edge_prices[edge_key][0]:
                        edge_prices[edge_key] = (price, flight_info)
        
        # Now build the graph with minimum prices
        graph = defaultdict(list)
        edge_list = [] #needed for kruskal
        
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

        #we always sort because MST picks minimum edges first

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

    #sort the edges by weight (price)
    #required by kruskal and also helpful for prims priority queue
    edge_list.sort(key=lambda x: x[0])
    
    return graph, edge_list, subgraph_airports

def prim_mst_simulate(source, dest, max_states=500):
    graph, edge_list, airports = build_undirected_graph_for_mst(source, dest)
    
    if source not in airports or dest not in airports:
        return {"mst_edges": [], "states": [], "error": "Source or destination not in graph"}
    
    source = source.strip().upper()
    dest = dest.strip().upper()
    
    start_ts = time.perf_counter()
    states = []
    step = 0
    
    mst_edges = []
    visited = set()
    pq = []
    
    visited.add(source)
    
    for neighbor, weight, flight_info in graph.get(source, []):
        heapq.heappush(pq, (weight, source, neighbor, flight_info))
    states.append({
        "step": step,
        "time_ms": (time.perf_counter() - start_ts) * 1000,
        "current_node": source,
        "visited": list(visited),
        "mst_edges": list(mst_edges),
        "pq": [(w, f, t) for w, f, t, _ in pq[:10]],
        "action": "start"
    })
    step += 1
    
    while pq and len(states) < max_states:
        if len(visited) >= len(airports):
            break
            
        weight, from_node, to_node, flight_info = heapq.heappop(pq)
        
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
        
        visited.add(to_node)
        edge_nodes = sorted([from_node, to_node])
        mst_edges.append({
            "from": edge_nodes[0],
            "to": edge_nodes[1],
            "weight": weight,
            "flight_info": flight_info
        })
        
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
    
    expected_edges = len(airports) - 1
    actual_edges = len(mst_edges)
    total_cost = sum(e["weight"] for e in mst_edges)
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

class UnionFind:
    """
    this class is used to detect cycles in kruskal's algorithm
    implements disjoint set union (DSU)
    """
    def __init__(self, nodes):
        #Constructor - each node is its own parent and rank is height of tree
        self.parent = {node: node for node in nodes}
        self.rank = {node: 0 for node in nodes}
    
    def find(self, x):
        #if x is not root, recursively find root and directly attach x to root
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]
    
    def union(self, x, y):
        root_x = self.find(x)
        root_y = self.find(y)
        #find roots and check if alr connected
        if root_x == root_y:
            return False

        #attach smaller rank tree under larger
        if self.rank[root_x] < self.rank[root_y]:
            self.parent[root_x] = root_y
        elif self.rank[root_x] > self.rank[root_y]:
            self.parent[root_y] = root_x
        else:
            self.parent[root_y] = root_x
            self.rank[root_x] += 1
        
        return True

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
    
    mst_edges = []
    uf = UnionFind(airports)
    states.append({
        "step": step,
        "time_ms": (time.perf_counter() - start_ts) * 1000,
        "current_edge": None,
        "mst_edges": list(mst_edges),
        "edge_list": [(w, f, t) for w, f, t, _ in edge_list[:20]],
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

