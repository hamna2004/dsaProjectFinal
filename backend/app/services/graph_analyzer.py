# graph_analyzer.py
# Graph analysis utilities: stats, adjacency matrix, degrees
from flask import g
from collections import defaultdict, deque
from ..db.connection import get_db_connection
import heapq

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
    
    return {
        "vertices": vertices,
        "edges": edges,
        "density": round(density, 4)
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
    cur = g.db_conn.cursor(dictionary=True)  # dictionary=True gives results as dicts instead of tuples   

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


    #now this query gives all the flights (and the data related to them)

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
        if hasattr(duration, 'total_seconds'):                # if duration is a timedelta object
            duration_min = int(duration.total_seconds() / 60)
        else:
            duration_min = int(duration) if duration else 0   # if duration is already in minutes or None
        
        if from_code in adjacency_list:  
            adjacency_list[from_code].append({       #adds edge to adjacency list
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

    """
    first get all airports to define matrix size
    """
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
    matrix = [[0 for _ in range(n)] for _ in range(n)]  #initialize empty matrix

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
        
        if from_code in code_to_index and to_code in code_to_index: # just a safety check
            i = code_to_index[from_code]
            j = code_to_index[to_code]
            matrix[i][j] = price
    
    return {
        "airports": airports,
        "matrix": matrix
    }

# used by MST-visualizer and graph-network-visualizer
def get_route_graph_analysis(source, dest, max_hops=3):
    """
    builds a directed graph and finds all actual paths from source to dest using DFS
    returns subgraph data containing only airports and edges on paths to destination
    """
    cur = g.db_conn.cursor(dictionary=True)
    
    source = source.strip().upper()
    dest = dest.strip().upper()

    cur.execute("""
        SELECT 
            sa.code AS `from`,
            da.code AS `to`,
            f.flight_no,
            f.price
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id
        WHERE sa.code IS NOT NULL AND da.code IS NOT NULL
    """)
    
    graph = {}  
    
    for row in cur.fetchall():
        from_code = row["from"].strip().upper()
        to_code = row["to"].strip().upper()
        
        if from_code not in graph:
            graph[from_code] = []
        graph[from_code].append({
            "to": to_code,
            "flight_no": row["flight_no"],
            "price": float(row["price"]) if row["price"] else 0.0
        })
    
    
    # Use DFS to find all paths from source to dest (up to max_hops)
    # Track airports and edges that are actually used in paths
    paths_airports = set([source, dest])  # Always include source and dest
    paths_edges_set = set()  # To avoid duplicate edges
    paths_edges = []  # List of edges that are part of actual paths
    total_paths = 0    

    """DFS to find all paths from source to dest"""

    def dfs_find_paths(current, path_airports, path_edges_list, hops_left):

        nonlocal total_paths  # Allow modifying outer scope variable

        if current == dest and len(path_airports) > 1:  # base case
            # Found a path - collect airports and edges
            paths_airports.update(path_airports)
            # Add all edges from this path
            for edge in path_edges_list:
                edge_key = (edge["from"], edge["to"], edge["flight_no"])
                if edge_key not in paths_edges_set:
                    paths_edges_set.add(edge_key)
                    paths_edges.append(edge)
            # Count total paths
            total_paths += 1
            return
        
        if hops_left <= 0:
            return
        
        # Explore neighbors
        for edge in graph.get(current, []):   # Look at all flights from the current airport
            neighbor = edge["to"]
            # Avoid cycles (don't revisit airports in current path)
            if neighbor not in path_airports:
                # Create edge object for this step
                edge_obj = {
                    "from": current,
                    "to": neighbor,
                    "flight_no": edge["flight_no"],
                    "price": edge["price"]
                }
                dfs_find_paths(neighbor, path_airports + [neighbor], path_edges_list + [edge_obj], hops_left - 1)
    
    # Find all paths
    dfs_find_paths(source, [source], [], max_hops)
    
    # Build subgraph with only edges that are part of actual paths
    subgraph_edges = []
    
    for edge in paths_edges:
        subgraph_edges.append({
            "from": edge["from"],
            "to": edge["to"],
            "price": edge["price"]
        })
        
    return {
        "source": source,
        "dest": dest,
        "subgraph": {
            "airports": sorted(list(paths_airports)),
            "edges": subgraph_edges,
            "vertices_count": len(paths_airports),
            "edges_count": len(subgraph_edges)
        },
        "path_stats": {
            "total_paths": total_paths
        }
    }

def build_undirected_graph_for_mst(source, dest):
    """
    Builds undirected graph for MST using airports on actual paths from source to dest
    (same as visualization graph for consistency)
    """
    source = source.strip().upper()
    dest = dest.strip().upper()
    
    # Reuse get_route_graph_analysis to get airports and edges on paths (avoids duplicating DFS logic and database query)
    route_analysis = get_route_graph_analysis(source, dest, max_hops=3)
    subgraph_airports = set(route_analysis["subgraph"]["airports"])
    subgraph_edges = route_analysis["subgraph"]["edges"]  # Reuse edges from route_analysis
    
    # Build undirected graph from subgraph edges

    edge_prices = {}  # (aiport_pair_sorted) -> (min_price, flight_info)
    
    # Find minimum price edges between airport pairs
    for edge in subgraph_edges:
        from_code = edge["from"]
        to_code = edge["to"]
        price = edge["price"]
        edge_key = tuple(sorted([from_code, to_code]))  # (A->B) and (B->A) same key # rn store alphabetically  
        if edge_key not in edge_prices or price < edge_prices[edge_key][0]: # Checksif the current price is cheaper than the stored one
            edge_prices[edge_key] = (price, edge)
    
    # Build the graph with minimum prices
    graph = defaultdict(list)
    edge_list = []  # needed for kruskal
    
    for (airport1, airport2), (min_price, flight_info) in edge_prices.items():
        # Add to both directions (undirected)
        graph[airport1].append((airport2, min_price, flight_info))
        graph[airport2].append((airport1, min_price, flight_info))
        edge_list.append((min_price, airport1, airport2, flight_info))
    
    # Sort the edges by weight (price)
    edge_list.sort(key=lambda x: x[0])    #  use the first element of each tuple as the sort key
    
    return graph, edge_list, subgraph_airports
    
def prim_mst_simulate(source, dest, max_states=500):
    # Get the graph data (airports and edges on paths from source to dest)
    graph, edge_list, airports = build_undirected_graph_for_mst(source, dest)
    
    if source not in airports or dest not in airports:
        return {"mst_edges": [], "states": [], "error": "Source or destination not in graph"}
    
    source = source.strip().upper()
    dest = dest.strip().upper()
    
    mst_edges = []
    visited = set()    # Tracks which airports we've already added to MST
    pq = []   # Min-heap priority queue for edges , stores (price, from_airport, to_airport, flight_info)
                        # Always gives us the cheapest edge first
    
    visited.add(source)
    

    # Add all edges from source to priority queue
    for neighbor, weight, flight_info in graph.get(source, []):
        heapq.heappush(pq, (weight, source, neighbor, flight_info)) #(weight, from_node, to_node, flight_info)

    
    # Save initial state (for visualization)
    states = [{
        "current_node": source,
        "visited": list(visited),
        "mst_edges": list(mst_edges),
    }]
    
    # Main Prim's algorithm loop
    # Keep going until we've connected all airports OR run out of edges OR hit max states
    while pq and len(states) < max_states:   # safety limit to prevent too many states.(default 500)
        if len(visited) >= len(airports): # all nodes visited
            break
        # Get the cheapest edge from priority queue    
        weight, from_node, to_node, flight_info = heapq.heappop(pq)
        
        if to_node in visited:
            # Already visited - skip to avoid cycles and save state
            states.append({
                "current_node": to_node,
                "visited": list(visited),
                "mst_edges": list(mst_edges),
                "edge": {"from": from_node, "to": to_node, "weight": weight}
            })
            continue
        
        
        visited.add(to_node)

        # Store edge in sorted order to ensure consistency (undirected)
        edge_nodes = sorted([from_node, to_node])
        mst_edges.append({
            "from": edge_nodes[0],
            "to": edge_nodes[1],
            "weight": weight,
            "flight_info": flight_info
        })
        
        # Now that we've added "to_node" to MST, explore flights from it
        for neighbor, n_weight, n_flight_info in graph.get(to_node, []):
            if neighbor not in visited:
                heapq.heappush(pq, (n_weight, to_node, neighbor, n_flight_info))
                # Add these new edges to priority queue for future consideration

        # Save state after adding this edge        
        states.append({
            "current_node": to_node,
            "visited": list(visited),
            "mst_edges": list(mst_edges),
            "edge": {"from": from_node, "to": to_node, "weight": weight}
        })
    
    total_cost = sum(e["weight"] for e in mst_edges)
    
    states.append({
        "current_node": None,
        "visited": list(visited),
        "mst_edges": list(mst_edges),
        "total_cost": total_cost
    })
    
    return {"mst_edges": mst_edges, "states": states, "airports": list(airports)}

class UnionFind:
    """
    this class is used to detect cycles in kruskal's algorithm
    implements disjoint set union (DSU)
    """

    """
    uf = UnionFind(["LHE", "ISB", "DXB", "KHI", "MUX"])

    # Each airport is its own parent (not connected to anyone)
    parent = {
    "LHE": "LHE",  # LHE's parent is LHE (it's the root)
    "ISB": "ISB",  # ISB's parent is ISB (it's the root)
    "DXB": "DXB",  # DXB's parent is DXB (it's the root)
    "KHI": "KHI",  # KHI's parent is KHI (it's the root)
    "MUX": "MUX"   # MUX's parent is MUX (it's the root)
    }

    # Each airport starts with rank 0 (single node = height 0)
    rank = {
    "LHE": 0,
    "ISB": 0,
    "DXB": 0,
    "KHI": 0,
    "MUX": 0
    
     Find root of LHE: find("LHE") → "LHE" (it's its own parent)
        Find root of ISB: find("ISB") → "ISB" (it's its own parent)
        Different roots → connect them
        Both have rank 0 → attach one under the other and increase rank
        union("LHE", "ISB")
    
    """


    def __init__(self, nodes):        
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
    # Get the graph data (airports and edges on paths from source to dest)
    graph, edge_list, airports = build_undirected_graph_for_mst(source, dest)
    
    if source not in airports or dest not in airports:
        return {"mst_edges": [], "states": [], "error": "Source or destination not in graph"}
    
    source = source.strip().upper()
    dest = dest.strip().upper()
    
    mst_edges = []
    uf = UnionFind(airports)
    states = [{
        "current_edge": None,
        "mst_edges": list(mst_edges),
    }]
    
    for weight, from_node, to_node, flight_info in edge_list:
        if len(states) >= max_states:   # reached max states
            break
        
        # Check if adding this edge creates a cycle
        if uf.find(from_node) == uf.find(to_node):
            # Skip - would create cycle
            states.append({
                "current_edge": {"from": from_node, "to": to_node, "weight": weight},
                "mst_edges": list(mst_edges),
            })
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
        
        states.append({
            "current_edge": {"from": from_node, "to": to_node, "weight": weight},
            "mst_edges": list(mst_edges),
        })
        
        # Stop if we have enough edges (V-1 edges for MST)
        if len(mst_edges) >= len(airports) - 1:
            break
    
    total_cost = sum(e["weight"] for e in mst_edges)
    states.append({
        "current_edge": None,
        "mst_edges": list(mst_edges),
        "total_cost": total_cost
    })
    
    return {"mst_edges": mst_edges, "states": states, "airports": list(airports)}

