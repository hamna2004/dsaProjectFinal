from typing import List, Dict
from ..db.connection import get_db_connection


# IF YOU DONT UNDERSTAND THIS,  OPEN AIRPORTS_SERVICE.PY
# I HAVE EXPLAINED THE CODE THERE
#THIS IS BASICALLY DOING THE SAME THING SO U'LL UNDERSTAND IF U READ THAT

def fetch_all_flights() -> List[Dict]:
    """
    Fetches all flights from the database with airport details.
    Returns a list of flight dictionaries.
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
    
    return result


def search_flights(source_code: str = None, dest_code: str = None) -> List[Dict]:
    """
    Searches flights by source and/or destination airport codes.
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
    
    query += " ORDER BY f.price ASC"
    
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
    
    return result

