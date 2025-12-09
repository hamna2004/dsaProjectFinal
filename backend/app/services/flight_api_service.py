import requests # For making HTTP requests to external APIs
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from ..db.connection import get_db_connection

def get_airport_id_by_code(code: str) -> Optional[int]:
    """
    WHAT THIS FUNCTION DOES:
    - Looks up an airport in the database by its code (e.g., "JFK", "LHE")
    - Returns the airport's ID number
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM airports WHERE code = %s", (code.upper(),))
    result = cursor.fetchone()
    cursor.close()
    return result["id"] if result else None


def fetch_flights_from_opensky(source_code: str = None, dest_code: str = None) -> List[Dict]:
    """
    Fetches real-time flight data from OpenSky Network API (FREE, no API key needed)
    Note: OpenSky provides live flight tracking, not scheduled flights
    """
    try:
        # OpenSky Network API endpoint
        url = "https://opensky-network.org/api/states/all"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            return []
        
        data = response.json()
        flights = []
        
        # OpenSky returns live flight states, we need to process them
        for state in data.get("states", []):
            if len(state) < 17:
                continue
                
            # Extract flight data
            icao24 = state[0]  # Aircraft identifier
            callsign = state[1].strip() if state[1] else None
            origin_country = state[2]
            time_position = state[3]
            longitude = state[5]
            latitude = state[6]
            velocity = state[9]  # m/s
            heading = state[10]
            
            if callsign and callsign.startswith(("PK", "EK", "QR", "TK", "LH", "AF", "BA")):
                # This is a commercial flight we might be interested in
                flights.append({
                    "callsign": callsign,
                    "latitude": latitude,
                    "longitude": longitude,
                    "origin_country": origin_country,
                    "velocity": velocity
                })
        
        return flights[:50]  # Limit to 50 flights
        
    except Exception as e:
        print(f"Error fetching from OpenSky: {e}")
        return []


def fetch_flights_from_aviationstack(source_code: str = None, dest_code: str = None, api_key: str = None) -> List[Dict]:
    """
    Fetches flight data from AviationStack API (requires free API key)
    Get your free API key from: https://aviationstack.com/
    
    Free tier: 1,000 requests/month
    """
    if not api_key:
        print("No API key provided for AviationStack")
        return []
    
    # Clean the API key (remove any whitespace)
    api_key = api_key.strip()
    
    try:
        url = "https://api.aviationstack.com/v1/flights"
        #url = "https://api.aviationstack.com/v1/flights?access_key=f3232299cf81575ae94220e0907f719e"
        params = {
            "access_key": api_key,
            "limit": 100
        }
        
        if source_code:
            params["dep_iata"] = source_code.upper()
        if dest_code:
            params["arr_iata"] = dest_code.upper()
        
        print(f"Calling AviationStack API with access_key: {api_key[:10]}...")
        print(f"Full URL will be: {url}?access_key={api_key[:10]}...&limit=100")
        response = requests.get(url, params=params, timeout=10)
        
        print(f"AviationStack response status: {response.status_code}")
        
        if response.status_code != 200:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("error", {}).get("message", "Unknown error")
            print(f"AviationStack API error (Status {response.status_code}): {error_msg}")
            raise Exception(f"AviationStack API Error: {error_msg}")
        
        data = response.json()
        
        # Check for API errors in response
        if "error" in data:
            error_msg = data["error"].get("message", "Unknown error")
            print(f"AviationStack API error: {error_msg}")
            raise Exception(f"AviationStack API Error: {error_msg}")
        
        flights = []
        
        for flight_data in data.get("data", []):
            flight_info = flight_data.get("flight", {})
            departure = flight_data.get("departure", {})
            arrival = flight_data.get("arrival", {})
            
            airline = flight_info.get("iata", "") or flight_info.get("icao", "")
            flight_no = flight_info.get("number", "")
            dep_airport = departure.get("iata", "")
            arr_airport = arrival.get("iata", "")
            dep_time = departure.get("scheduled", "")
            arr_time = arrival.get("scheduled", "")
            
            if dep_airport and arr_airport:
                flights.append({
                    "airline": airline or "Unknown",
                    "flight_no": flight_no or f"{airline}{flight_info.get('number', '')}",
                    "source_code": dep_airport,
                    "dest_code": arr_airport,
                    "departure_time": dep_time,
                    "arrival_time": arr_time
                })
        
        print(f"Fetched {len(flights)} flights from AviationStack")
        return flights
        
    except Exception as e:
        print(f"Error fetching from AviationStack: {e}")
        import traceback
        traceback.print_exc()
        return []


def sync_flights_to_database(flights: List[Dict], source: str = "api") -> int:
    """
    Syncs flight data from API to database.
    Returns number of flights added/updated.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    
    added_count = 0
    
    for flight in flights:
        try:
            source_code = flight.get("source_code") or flight.get("dep_airport")
            dest_code = flight.get("dest_code") or flight.get("arr_airport")
            
            if not source_code or not dest_code:
                continue
            
            source_id = get_airport_id_by_code(source_code)
            dest_id = get_airport_id_by_code(dest_code)
            
            # Normalise airline / flight number – ensure we always have values
            airline = flight.get("airline") or "Unknown Airline"
            flight_no = flight.get("flight_no") or "UNKNOWN"

            if not source_id or not dest_id:
                # Airport doesn't exist, skip
                print(f"Skipping flight {flight_no}: Airport {source_code} or {dest_code} not found in database")
                continue
            
            # Calculate duration (if times are provided)
            duration = None
            price = None
            
            dep_time = flight.get("departure_time")
            arr_time = flight.get("arrival_time")
            
            if dep_time and arr_time:
                try:
                    dep = datetime.fromisoformat(dep_time.replace("Z", "+00:00"))
                    arr = datetime.fromisoformat(arr_time.replace("Z", "+00:00"))
                    duration = int((arr - dep).total_seconds() / 60)
                except:
                    pass
            
            # Estimate price based on distance (rough calculation)
            if source_id and dest_id:
                cursor.execute("""
                    SELECT latitude, longitude FROM airports WHERE id IN (%s, %s)
                """, (source_id, dest_id))
                coords = cursor.fetchall()
                if len(coords) == 2:
                    # Rough price estimate: $0.10 per km
                    import math
                    lat1, lon1 = coords[0]["latitude"], coords[0]["longitude"]
                    lat2, lon2 = coords[1]["latitude"], coords[1]["longitude"]
                    if all([lat1, lon1, lat2, lon2]):
                        # Haversine formula
                        R = 6371  # Earth radius in km
                        lat1_rad = math.radians(lat1)
                        lon1_rad = math.radians(lon1)
                        lat2_rad = math.radians(lat2)
                        lon2_rad = math.radians(lon2)
                        dlat = lat2_rad - lat1_rad
                        dlon = lon2_rad - lon1_rad
                        a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
                        c = 2 * math.asin(math.sqrt(a))
                        dist = R * c
                        price = round(dist * 0.10, 2)
            
            # Check if flight already exists
            cursor.execute("""
                SELECT id FROM flights 
                WHERE flight_no = %s AND source_airport = %s AND dest_airport = %s
            """, (flight_no, source_id, dest_id))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing flight
                cursor.execute("""
                    UPDATE flights 
                    SET departure_time = %s, arrival_time = %s, duration = %s, price = %s
                    WHERE id = %s
                """, (dep_time, arr_time, duration, price, existing["id"]))
            else:
                # Insert new flight
                cursor.execute("""
                    INSERT INTO flights 
                    (airline, flight_no, source_airport, dest_airport, departure_time, arrival_time, duration, price)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (airline, flight_no, source_id, dest_id, dep_time, arr_time, duration, price))
            
            added_count += 1
            
        except Exception as e:
            print(f"Error syncing flight: {e}")
            continue
    
    conn.commit()
    cursor.close()
    
    return added_count


def fetch_and_sync_real_time_flights(api_key: str = None, source_code: str = None, dest_code: str = None) -> Dict:
    """
    Main function to fetch real-time flights and sync to database.
    """
    result = {
        "success": False,
        "flights_fetched": 0,
        "flights_synced": 0,
        "source": None,
        "message": ""
    }
    
    # Try AviationStack first (if API key provided)
    if api_key:
        print(f"Attempting to fetch from AviationStack with API key: {api_key[:10]}...")
        try:
            flights = fetch_flights_from_aviationstack(source_code, dest_code, api_key)
            if flights:
                result["source"] = "aviationstack"
                result["flights_fetched"] = len(flights)
                synced = sync_flights_to_database(flights, "aviationstack")
                result["flights_synced"] = synced
                result["success"] = True
                result["message"] = f"Synced {synced} flights from AviationStack"
                return result
            else:
                result["message"] = "AviationStack returned no flights. Check airport codes in database."
        except Exception as e:
            result["message"] = str(e)
            result["success"] = False
            return result
    
    # Fallback: Use OpenSky (free, but limited data)
    print("Falling back to OpenSky...")
    flights = fetch_flights_from_opensky(source_code, dest_code)
    if flights:
        result["source"] = "opensky"
        result["flights_fetched"] = len(flights)
        result["message"] = "OpenSky provides live tracking data. Use AviationStack for scheduled flights."
        result["success"] = True
    else:
        result["message"] = "No flights found from any source. Check your API key and ensure airports exist in database."
    
    return result

