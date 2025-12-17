from typing import List, Dict, Callable, Optional
from ..db.connection import get_db_connection

# IF YOU DONT UNDERSTAND THIS,  OPEN AIRPORTS_SERVICE.PY
# I HAVE EXPLAINED THE CODE THERE
#THIS IS BASICALLY DOING THE SAME THING SO U'LL UNDERSTAND IF U READ THAT

# ============================================
# MERGE SORT ALGORITHM IMPLEMENTATION
# ============================================
def merge_sort_flights(flights: List[Dict], compare_fn: Callable) -> List[Dict]:
    """
    Merge Sort algorithm implementation for sorting flights.
    
    Time Complexity: O(n log n)
    Space Complexity: O(n)
    
    Args:
        flights: List of flight dictionaries to sort
        compare_fn: Comparison function that returns True if first flight should come before second
    
    Returns:
        Sorted list of flights
    """
    if len(flights) <= 1:
        return flights
    
    # Divide: Split the array into two halves
    mid = len(flights) // 2
    left = flights[:mid]
    right = flights[mid:]
    
    # Conquer: Recursively sort both halves
    left = merge_sort_flights(left, compare_fn)
    right = merge_sort_flights(right, compare_fn)
    
    # Combine: Merge the sorted halves
    return merge_flights(left, right, compare_fn)


def merge_flights(left: List[Dict], right: List[Dict], compare_fn: Callable) -> List[Dict]:
    """
    Merge two sorted lists into one sorted list.
    
    Args:
        left: First sorted list
        right: Second sorted list
        compare_fn: Comparison function
    
    Returns:
        Merged sorted list
    """
    result = []
    i = j = 0
    
    # Compare elements from both lists and merge in sorted order
    while i < len(left) and j < len(right):
        if compare_fn(left[i], right[j]):
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    
    # Add remaining elements from left list
    while i < len(left):
        result.append(left[i])
        i += 1
    
    # Add remaining elements from right list
    while j < len(right):
        result.append(right[j])
        j += 1
    
    return result


def get_comparison_function(sort_key: str) -> Callable:
    """
    Returns a comparison function based on the sort key.
    
    Args:
        sort_key: 'price', 'duration', or 'airline'
    
    Returns:
        Comparison function for merge sort
    """
    if sort_key == "price":
        def compare(a: Dict, b: Dict) -> bool:
            price_a = a.get("price") or 0
            price_b = b.get("price") or 0
            return price_a <= price_b
        return compare
    
    elif sort_key == "duration":
        def compare(a: Dict, b: Dict) -> bool:
            # Handle timedelta objects
            duration_a = a.get("duration")
            duration_b = b.get("duration")
            
            # Convert timedelta to minutes if needed
            if hasattr(duration_a, 'total_seconds'):
                duration_a = int(duration_a.total_seconds() / 60)
            elif duration_a is None:
                duration_a = 0
            else:
                duration_a = int(duration_a) if duration_a else 0
            
            if hasattr(duration_b, 'total_seconds'):
                duration_b = int(duration_b.total_seconds() / 60)
            elif duration_b is None:
                duration_b = 0
            else:
                duration_b = int(duration_b) if duration_b else 0
            
            return duration_a <= duration_b
        return compare
    
    elif sort_key == "airline":
        def compare(a: Dict, b: Dict) -> bool:
            airline_a = (a.get("airline") or "").lower()
            airline_b = (b.get("airline") or "").lower()
            return airline_a <= airline_b
        return compare
    
    else:
        # Default: no sorting (return as-is)
        def compare(a: Dict, b: Dict) -> bool:
            return True
        return compare


def sort_flights(flights: List[Dict], sort_key: Optional[str] = None) -> List[Dict]:
    """
    Sort flights using Merge Sort algorithm.
    
    Args:
        flights: List of flight dictionaries
        sort_key: 'price', 'duration', 'airline', or None (no sorting)
    
    Returns:
        Sorted list of flights
    """
    if not sort_key or sort_key not in ["price", "duration", "airline"]:
        return flights
    
    compare_fn = get_comparison_function(sort_key)
    return merge_sort_flights(flights, compare_fn)


# ============================================
# LINEAR SEARCH ALGORITHM IMPLEMENTATION
# ============================================
def linear_search_flights(flights: List[Dict], search_query: str) -> List[Dict]:
    """
    Linear Search algorithm implementation for searching flights.
    
    Time Complexity: O(n) where n = number of flights
    Space Complexity: O(1) excluding output array
    
    Searches through all flights and matches against:
    - Flight number
    - Airline name
    - Source airport code
    - Destination airport code
    
    Args:
        flights: List of flight dictionaries to search
        search_query: Search string (case-insensitive)
    
    Returns:
        List of flights matching the search query
    """
    if not search_query or not search_query.strip():
        return flights
    
    search_query = search_query.strip().lower()
    results = []
    
    # Linear search: iterate through each flight
    for flight in flights:
        # Check flight number
        flight_no = (flight.get("flight_no") or "").lower()
        if search_query in flight_no:
            results.append(flight)
            continue  # Found a match, move to next flight
        
        # Check airline name
        airline = (flight.get("airline") or "").lower()
        if search_query in airline:
            results.append(flight)
            continue
        
        # Check source airport code
        source_code = ""
        if flight.get("source_airport"):
            source_code = (flight.get("source_airport", {}).get("code") or "").lower()
        if search_query in source_code:
            results.append(flight)
            continue
        
        # Check destination airport code
        dest_code = ""
        if flight.get("dest_airport"):
            dest_code = (flight.get("dest_airport", {}).get("code") or "").lower()
        if search_query in dest_code:
            results.append(flight)
            continue
    
    return results


def search_flights_by_query(flights: List[Dict], search_query: Optional[str] = None) -> List[Dict]:
    """
    Search flights using Linear Search algorithm.
    
    Args:
        flights: List of flight dictionaries
        search_query: Optional search string to filter flights
    
    Returns:
        Filtered list of flights matching the search query
    """
    if not search_query or not search_query.strip():
        return flights
    
    return linear_search_flights(flights, search_query)

def fetch_all_flights(sort_key: Optional[str] = None, search_query: Optional[str] = None) -> List[Dict]:
    """
    Fetches all flights from the database with airport details.
    Returns a list of flight dictionaries, optionally sorted using Merge Sort.
    
    Args:
        sort_key: Optional sorting key ('price', 'duration', 'airline')
    
    Returns:
        List of flight dictionaries (sorted if sort_key provided)
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    query = """
        SELECT 
            f.id,
            f.airline,
            f.flight_no,
            f.departure_time,
            f.arrival_time,
            f.duration,
            f.price,
            sa.id as source_airport_id,
            sa.name as source_airport_name,
            sa.city as source_city,
            sa.code as source_code,
            da.id as dest_airport_id,
            da.name as dest_airport_name,
            da.city as dest_city,
            da.code as dest_code
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id
        ORDER BY f.id
    """
    
    cursor.execute(query)
    flights = cursor.fetchall()
    cursor.close()
    
    # Convert datetime/time objects to strings for JSON serialization
    result = []
    for flight in flights:
        result.append({
            "id": flight["id"],
            "airline": flight["airline"],
            "flight_no": flight["flight_no"],
            "source_airport": {
                "id": flight["source_airport_id"],
                "name": flight["source_airport_name"],
                "city": flight["source_city"],
                "code": flight["source_code"]
            },
            "dest_airport": {
                "id": flight["dest_airport_id"],
                "name": flight["dest_airport_name"],
                "city": flight["dest_city"],
                "code": flight["dest_code"]
            },
            "departure_time": str(flight["departure_time"]) if flight["departure_time"] else None,
            "arrival_time": str(flight["arrival_time"]) if flight["arrival_time"] else None,
            "duration": flight["duration"],
            "price": float(flight["price"]) if flight["price"] else None
        })
    
    # Search using Linear Search algorithm if search_query provided
    if search_query:
        result = search_flights_by_query(result, search_query)
    
    # Sort using Merge Sort algorithm if sort_key provided
    if sort_key:
        result = sort_flights(result, sort_key)
    
    return result


def search_flights(source_code: str = None, dest_code: str = None, sort_key: Optional[str] = None, search_query: Optional[str] = None) -> List[Dict]:
    """
    Searches flights by source and/or destination airport codes.
    Optionally sorts results using Merge Sort algorithm.
    
    Args:
        source_code: Optional source airport code
        dest_code: Optional destination airport code
        sort_key: Optional sorting key ('price', 'duration', 'airline')
    
    Returns:
        List of flight dictionaries (sorted if sort_key provided)
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    query = """
        SELECT 
            f.id,
            f.airline,
            f.flight_no,
            f.departure_time,
            f.arrival_time,
            f.duration,
            f.price,
            sa.id as source_airport_id,
            sa.name as source_airport_name,
            sa.city as source_city,
            sa.code as source_code,
            da.id as dest_airport_id,
            da.name as dest_airport_name,
            da.city as dest_city,
            da.code as dest_code
        FROM flights f
        LEFT JOIN airports sa ON f.source_airport = sa.id
        LEFT JOIN airports da ON f.dest_airport = da.id
        WHERE 1=1
    """

    # Build a list of parameters to pass to the query
    params = []

    if source_code:
        query += " AND sa.code = %s" #using %s as a placeholder for the parameter
        params.append(source_code.upper())
    if dest_code:
        query += " AND da.code = %s"
        params.append(dest_code.upper())
    
    # Remove hardcoded ORDER BY - sorting will be done by Merge Sort
    query += " ORDER BY f.id"
    
    cursor.execute(query, params)
    flights = cursor.fetchall()
    cursor.close()
    
    # Convert to JSON-serializable format
    result = []
    for flight in flights:
        result.append({
            "id": flight["id"],
            "airline": flight["airline"],
            "flight_no": flight["flight_no"],
            "source_airport": {
                "id": flight["source_airport_id"],
                "name": flight["source_airport_name"],
                "city": flight["source_city"],
                "code": flight["source_code"]
            },
            "dest_airport": {
                "id": flight["dest_airport_id"],
                "name": flight["dest_airport_name"],
                "city": flight["dest_city"],
                "code": flight["dest_code"]
            },
            "departure_time": str(flight["departure_time"]) if flight["departure_time"] else None,
            "arrival_time": str(flight["arrival_time"]) if flight["arrival_time"] else None,
            "duration": flight["duration"],
            "price": float(flight["price"]) if flight["price"] else None
        })
    
    # Search using Linear Search algorithm if search_query provided
    if search_query:
        result = search_flights_by_query(result, search_query)
    
    # Sort using Merge Sort algorithm if sort_key provided
    if sort_key:
        result = sort_flights(result, sort_key)
    
    return result


def get_dashboard_stats() -> Dict:
    """
    Fetches dashboard statistics: total flights, active routes, and average price.
    Returns a dictionary with stats.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Total flights
    cursor.execute("SELECT COUNT(*) as total FROM flights")
    total_flights = cursor.fetchone()["total"]
    
    # Active routes (unique source-destination pairs)
    cursor.execute("""
        SELECT COUNT(DISTINCT CONCAT(source_airport, '-', dest_airport)) as routes
        FROM flights
    """)
    active_routes = cursor.fetchone()["routes"]
    
    # Average price
    cursor.execute("SELECT AVG(price) as avg_price FROM flights WHERE price IS NOT NULL")
    avg_price_result = cursor.fetchone()["avg_price"]
    average_price = round(float(avg_price_result), 2) if avg_price_result else 0
    
    cursor.close()
    
    return {
        "totalFlights": total_flights,
        "activeRoutes": active_routes,
        "averagePrice": average_price
    }
