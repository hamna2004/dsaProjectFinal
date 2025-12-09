from typing import List, Dict
from ..db.connection import get_db_connection

def fetch_all_airports() -> List[Dict]:
    """
    Fetches all airports from the database.
    Returns a list of airport dictionaries.
    -> List[Dict] means "this function returns a list of dictionaries"
    """
    conn = get_db_connection()
    # A cursor is like a "pointer" that lets us execute SQL queries
    # dictionary=True means: return results as dictionaries (not tuples)
    cursor = conn.cursor(dictionary=True)
    
    query = """
        SELECT 
            id,
            name,
            city,
            country,
            code,
            latitude,
            longitude
        FROM airports
        ORDER BY city, name
    """

    # Send the SQL query to the database
    # it will run the query and prepare the results
    cursor.execute(query)

    #fetch the results from database
    airports = cursor.fetchall()

    cursor.close()
    
    # Convert to JSON-serializable format
    result = []
    for airport in airports:
        result.append({
            "id": airport["id"],
            "name": airport["name"],
            "city": airport["city"],
            "country": airport["country"],
            "code": airport["code"],
            "latitude": float(airport["latitude"]) if airport["latitude"] else None,
            "longitude": float(airport["longitude"]) if airport["longitude"] else None
        })
    
    return result

# this returns the list of airport dictionaries to routes from where they get sent to frontend.
