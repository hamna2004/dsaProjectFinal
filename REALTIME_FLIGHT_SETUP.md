# Real-Time Flight Data Setup Guide

## Overview
Your Flight Route Planner now supports fetching real-time flight data from external APIs!

## Step 1: Install Required Package

```powershell
# Activate your virtual environment
venv\Scripts\activate

# Install requests library
pip install requests
```

## Step 2: Get API Key (Optional but Recommended)

### Option A: AviationStack (Recommended - Better Data)
1. Go to: https://aviationstack.com/
2. Sign up for free account
3. Get your API key (Free tier: 1,000 requests/month)
4. Copy your API key

### Option B: OpenSky Network (Free, No API Key)
- No signup needed
- Limited to live flight tracking (not scheduled flights)
- Works immediately without API key

## Step 3: Sync Real-Time Flights

### Method 1: Using API Endpoint (Recommended)

**With AviationStack API Key:**
```bash
POST http://localhost:5000/api/flights/sync
Content-Type: application/json

{
  "api_key": "your_aviationstack_api_key_here"
}
```

**With Filters (specific route):**
```bash
POST http://localhost:5000/api/flights/sync
Content-Type: application/json

{
  "api_key": "your_api_key",
  "source": "LHE",
  "dest": "JFK"
}
```

**Without API Key (uses OpenSky - limited):**
```bash
POST http://localhost:5000/api/flights/sync
```

### Method 2: Using cURL

```bash
curl -X POST http://localhost:5000/api/flights/sync \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_api_key_here"}'
```

### Method 3: Using Postman
1. Create new POST request
2. URL: `http://localhost:5000/api/flights/sync`
3. Body (raw JSON):
```json
{
  "api_key": "your_aviationstack_api_key"
}
```

## Step 4: Verify

After syncing, check your database:
```sql
SELECT COUNT(*) FROM flights;
```

Or check via API:
```
GET http://localhost:5000/api/flights
```

## How It Works

1. **Fetches** flight data from external API
2. **Matches** airports by IATA code (e.g., LHE, JFK)
3. **Calculates** duration and estimates price
4. **Stores** in your MySQL database
5. **Your path-finding algorithm** uses this real-time data!

## Notes

- **AviationStack**: Better for scheduled flights, routes, prices
- **OpenSky**: Free but limited to live flight tracking
- Flights are automatically matched to airports in your database
- If airport doesn't exist, flight is skipped
- Price is estimated based on distance ($0.10/km)

## Troubleshooting

**No flights synced?**
- Check if airports exist in your database
- Verify API key is correct (for AviationStack)
- Check backend logs for errors

**API rate limit?**
- AviationStack free tier: 1,000 requests/month
- OpenSky: No limit but slower

## Next Steps

1. Set up a cron job/scheduler to sync flights automatically
2. Add more airports to your database for better coverage
3. Integrate with frontend to show "Last updated" timestamp

