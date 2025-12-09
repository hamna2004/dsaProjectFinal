"""
Quick test script to verify your AviationStack API key works
Run this: python test_api_key.py
"""

import requests

# Paste your API key here
API_KEY = "f3232299cf81575ae94220e0907f719e"

# Clean the key
API_KEY = API_KEY.strip()

url = "https://api.aviationstack.com/v1/flights"
params = {
    "access_key": API_KEY,
    "limit": 1  # Just test with 1 flight
}

print(f"Testing API key: {API_KEY[:10]}...")
print(f"Full key length: {len(API_KEY)} characters")
print(f"URL: {url}")
print(f"Params: access_key={API_KEY[:10]}...&limit=1")
print(f"\nMaking request...")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"\nStatus Code: {response.status_code}")
    
    response_data = response.json()
    print(f"Response: {response_data}")
    
    if response.status_code == 200 and "data" in response_data:
        print("\n✅ API Key is VALID!")
        print(f"Found {len(response_data.get('data', []))} flights")
    elif "error" in response_data:
        error = response_data.get("error", {})
        print(f"\n❌ API Error: {error.get('message', 'Unknown error')}")
        print(f"Error code: {error.get('code', 'Unknown')}")
        print("\nPossible issues:")
        print("1. API key not activated - check your email")
        print("2. Wrong API key - verify in dashboard")
        print("3. Account not set up - check https://aviationstack.com/dashboard")
    else:
        print("\n❌ Unexpected response")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

