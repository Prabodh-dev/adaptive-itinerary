# Phase 3 Testing Guide

This guide will help you test the Phase 3 implementation (Weather Monitoring + Suggestions + SSE).

## Prerequisites

1. **Environment Setup**: Make sure `.env` file has these variables:
   ```
   OPENWEATHER_API_KEY=your_key_here
   WEATHER_POLL_INTERVAL_SEC=120
   MAPBOX_ACCESS_TOKEN=your_token_here
   FOURSQUARE_API_KEY=your_key_here
   ```

2. **Dependencies Installed**:
   ```bash
   pnpm install
   ```

## Testing Methods

### Method 1: Automated Test Script (Bash)

1. **Start the API server** in one terminal:
   ```bash
   pnpm dev:api
   ```

2. **Run the test script** in another terminal:
   ```bash
   bash test-phase3.sh
   ```

This will:
- Create a test trip
- Add outdoor activities
- Generate an itinerary
- Post mock weather data with rain risk
- Trigger suggestion generation
- Display all results

### Method 2: Manual Testing with Web UI

1. **Start all services** (3 terminals):
   
   Terminal 1 - API Server:
   ```bash
   pnpm dev:api
   ```
   
   Terminal 2 - Web UI:
   ```bash
   pnpm dev:web
   ```
   
   Terminal 3 - Worker (with OpenWeather API key):
   ```bash
   pnpm dev:worker
   ```

2. **Create a trip via Web UI**:
   - Open http://localhost:3000
   - Fill in trip details:
     - City: San Francisco
     - Date: Tomorrow's date
     - Start Time: 09:00
     - End Time: 18:00
   - Add outdoor activities (isIndoor: false):
     - Search for "park" or "beach"
     - Add at least 2-3 outdoor places
   - Click "Generate Itinerary"

3. **Observe real-time updates**:
   - Worker will poll weather every 2 minutes
   - If rain is detected during itinerary hours, a suggestion will appear
   - Suggestion card shows "REORDER" with reasons
   - SSE connection shows live updates in browser console

4. **Test suggestion actions**:
   - Click "Accept" to regenerate itinerary with outdoor activities moved earlier
   - New itinerary version is created
   - Suggestion disappears after acceptance

### Method 3: Direct API Testing with curl

Test individual endpoints:

#### 1. Health Check
```bash
curl http://localhost:8080/health
```

#### 2. Create Trip
```bash
curl -X POST http://localhost:8080/trip \
  -H "Content-Type: application/json" \
  -d '{
    "city": "San Francisco",
    "date": "2026-02-22",
    "startTime": "09:00",
    "endTime": "18:00",
    "preferences": {}
  }'
```
Response: `{"tripId":"trp_xxxxx"}`

#### 3. Add Activities (use tripId from above)
```bash
TRIP_ID="trp_xxxxx"

curl -X POST http://localhost:8080/trip/$TRIP_ID/activities \
  -H "Content-Type: application/json" \
  -d '{
    "activities": [
      {
        "place": {
          "provider": "test",
          "providerPlaceId": "1",
          "name": "Outdoor Park",
          "lat": 37.77,
          "lng": -122.48,
          "isIndoor": false
        },
        "durationMin": 90,
        "locked": false
      }
    ]
  }'
```

#### 4. Generate Itinerary
```bash
curl -X POST http://localhost:8080/trip/$TRIP_ID/itinerary/generate \
  -H "Content-Type: application/json" \
  -d '{"mode": "driving"}'
```

#### 5. Get Weather Signals (initially empty)
```bash
curl http://localhost:8080/trip/$TRIP_ID/signals
```
Response: `{"weather":null}` or `{"weather":{"summary":"...","riskHours":[...]}}`

#### 6. Post Weather Signal (simulate worker)
```bash
curl -X POST http://localhost:8080/internal/trip/$TRIP_ID/signals/weather \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Rain risk between 14:00–17:00",
    "riskHours": ["14:00", "15:00", "16:00", "17:00"],
    "raw": {}
  }'
```

#### 7. Trigger Recompute (generate suggestions)
```bash
curl -X POST http://localhost:8080/internal/trip/$TRIP_ID/recompute \
  -H "Content-Type: application/json"
```
Response: `{"ok":true,"suggestion":{...}}` if outdoor activities overlap with rain

#### 8. Get Suggestions
```bash
curl http://localhost:8080/trip/$TRIP_ID/suggestions
```
Response: `{"suggestions":[{"suggestionId":"...","kind":"reorder","reasons":[...],...}]}`

#### 9. Get All Trip IDs (for worker)
```bash
curl http://localhost:8080/trips
```
Response: `{"tripIds":["trp_xxxxx","trp_yyyyy"]}`

#### 10. Test SSE Stream
```bash
curl -N http://localhost:8080/trip/$TRIP_ID/stream
```
You should see:
```
event: ping
data: {"message":"connected","tripId":"trp_xxxxx"}

event: signal:update
data: {...}
```

Keep connection open and post weather signals in another terminal to see real-time events.

## Expected Behavior

### Weather Analysis Logic
- **Risk Hours**: Hours marked as risky if:
  - `pop >= 0.6` (60%+ probability of precipitation), OR
  - Weather type includes "Rain", "Thunderstorm", or "Drizzle"

### Suggestion Generation
- **Triggers**: Only when outdoor activities (`isIndoor === false`) are scheduled during rain-risk hours
- **Action**: Generates "reorder" suggestion to move outdoor activities earlier
- **Reasons**: Includes:
  - "Rain risk detected during HH:mm–HH:mm"
  - "N outdoor activity/activities scheduled during rain risk"
  - "Moved outdoor stops earlier to avoid rain"

### Real-Time Updates (SSE)
- **Events**:
  - `ping`: Initial connection confirmation
  - `signal:update`: Weather signal changed
  - `suggestion:new`: New suggestion created
  - `itinerary:version`: Itinerary regenerated

## Troubleshooting

### API Server Won't Start
- Check if port 8080 is available: `netstat -an | grep 8080`
- Verify all required API keys are set in `.env`
- Check logs for errors

### Worker Not Posting Weather
- Verify `OPENWEATHER_API_KEY` is set and valid
- Check worker logs for errors
- Verify API server is running and accessible
- Test OpenWeather API directly:
  ```bash
  curl "https://api.openweathermap.org/data/2.5/forecast?lat=37.77&lon=-122.48&appid=YOUR_KEY&units=metric"
  ```

### No Suggestions Generated
- Verify outdoor activities exist (`isIndoor: false`)
- Verify weather signal has risk hours
- Check if risk hours overlap with activity times
- Run recompute manually: `curl -X POST http://localhost:8080/internal/trip/$TRIP_ID/recompute`

### SSE Not Working
- Browser console should show connection
- Network tab should show stream connection as "pending"
- Check CORS settings if accessing from different origin
- Verify API server has registered stream routes

## Success Criteria

✅ API server starts without errors  
✅ All routes respond correctly  
✅ Weather signals can be stored and retrieved  
✅ Suggestions are generated when outdoor activities overlap with rain  
✅ SSE connection establishes and receives events  
✅ Worker polls weather and updates API  
✅ Web UI displays weather signals and suggestions  
✅ Accepting a suggestion regenerates itinerary  

## Next Steps

After Phase 3 is verified:
- Test with real OpenWeather API data
- Test with multiple trips
- Test worker polling cycle (wait 2+ minutes)
- Test concurrent SSE connections
- Test suggestion acceptance workflow in web UI
- Add more suggestion types (swap, shift)
