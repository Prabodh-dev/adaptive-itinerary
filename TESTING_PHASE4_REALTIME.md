# Phase 4 - Real-Time Crowd Detection Testing Guide

## Prerequisites

### 1. Get BestTime PRIVATE API Key

⚠️ **IMPORTANT**: You need a **PRIVATE** API key, not a public key!

1. Go to https://besttime.app/api/v1/keys
2. Find your **Private API Key** (starts with `pri_`)
3. Copy the full key

### 2. Update .env

```bash
# Add to .env
BESTTIME_API_KEY_PRIVATE=pri_your_actual_private_key_here
```

### 3. Restart Services

```bash
# Stop current services (Ctrl+C)
pnpm dev
```

---

## How It Works

### Worker Flow

1. **Every 5 minutes** (CROWD_POLL_INTERVAL_SEC=300):
   - Worker fetches all trips
   - For each trip, gets up to 8 activities (MAX_CROWD_VENUES_PER_TRIP)
   
2. **For each activity/venue**:
   - Check venue cache (in-memory Map)
   - If not cached:
     - Call `besttimeNewForecast` → get venue_id + peak hours
     - Cache venue_id and peak hours for trip date
   - Call `besttimeLive` with venue_id → get real-time busyNow
   - Wait 200ms (rate limiting: 5 req/sec)

3. **Post crowd signals**:
   - POST `/internal/trip/:tripId/signals/crowds`
   - Body: `{ observedAt, crowds: [{ placeId, placeName, busyNow, peakHours }] }`
   - SSE emits `signal:update` event

4. **Trigger recompute**:
   - POST `/internal/trip/:tripId/recompute`
   - Calls `buildCrowdSuggestion()`
   - If busyNow >= 85 OR scheduled during peak hours → create suggestion
   - SSE emits `suggestion:new` event

---

## Testing Steps

### Test 1: Manual API Test

**Create a trip with crowd-prone venues:**

```bash
# 1. Create trip
$trip = Invoke-RestMethod -Uri "http://localhost:8080/trip" -Method Post -Body (@{
  city="New York"
  date="2026-02-22"
  startTime="09:00"
  endTime="22:00"
  preferences=@{pace="medium";interests=@("culture");avoid=@();budget="medium"}
} | ConvertTo-Json -Depth 10) -ContentType "application/json"
$tripId = $trip.tripId
Write-Host "Trip: $tripId"

# 2. Add popular venues (Times Square, Central Park, etc.)
Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/activities" -Method Post -Body (@{
  activities=@(
    @{
      place=@{
        provider="foursquare"
        providerPlaceId="place_1"
        name="Times Square"
        lat=40.7580
        lng=-73.9855
        address="Times Square, New York, NY"
        category="Tourist Attraction"
      }
      durationMin=60
      locked=$false
    },
    @{
      place=@{
        provider="foursquare"
        providerPlaceId="place_2"
        name="Central Park"
        lat=40.7829
        lng=-73.9654
        address="Central Park, New York, NY"
        category="Park"
      }
      durationMin=90
      locked=$false
    }
  )
} | ConvertTo-Json -Depth 10) -ContentType "application/json"

# 3. Generate itinerary
Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/itinerary" -Method Post -Body (@{
  mode="driving"
  optimizeOrder=$true
} | ConvertTo-Json) -ContentType "application/json"

# 4. Wait for worker to poll (5 minutes) OR manually trigger
# Watch worker logs for:
# [Crowds][trp_xxx] Fetching forecast for Times Square...
# [Crowds][trp_xxx] Times Square: 95% (live), peak 12:00, 13:00, 14:00

# 5. Check signals
$signals = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/signals"
$signals.crowds | Format-Table

# 6. Check suggestions
$suggestions = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/suggestions"
$suggestions.suggestions | ConvertTo-Json -Depth 10
```

---

### Test 2: Web UI Test

1. **Open** http://localhost:3000
2. **Create trip**: Select a city, tomorrow's date
3. **Add activities**: Add 3-5 popular tourist spots
4. **Generate itinerary**
5. **Wait 5 minutes** for worker to poll
6. **Check Signals panel**: Should show crowd percentages for each place
7. **Check Suggestions**: If any place is busy (>85%) or scheduled during peak, you'll see suggestions

---

## Expected Worker Logs

### Successful Polling

```
[Crowds] Polling crowd data...
[Crowds] Found 1 trips
[Crowds][trp_abc123] Processing trip...
[Crowds][trp_abc123] Fetching crowd data for 2 places (max 8)...
[Crowds] Fetching forecast for Times Square...
[Crowds] Cached venue Times Square: venueId=ven-5e1...a7c, peaks=12:00,13:00,14:00
[Crowds][trp_abc123] Fetching live data for Times Square...
[Crowds][trp_abc123] Times Square: 95% (live), peak 12:00, 13:00, 14:00
[Crowds] Fetching forecast for Central Park...
[Crowds] Cached venue Central Park: venueId=ven-8f2...b4d, peaks=10:00,11:00,16:00,17:00
[Crowds][trp_abc123] Fetching live data for Central Park...
[Crowds][trp_abc123] Central Park: 67% (forecasted), peak 10:00, 11:00, 16:00, 17:00
[Crowds][trp_abc123] Crowd signals posted (2 places)
[Crowds][trp_abc123] Recompute triggered
[Crowds] Polling cycle complete
```

### If API Key Missing

```
=== Weather & Crowd Worker (BestTime Real API) ===
API URL: http://localhost:8080
Weather poll interval: 120s
Crowd poll interval: 300s
Crowd detection: ✗ DISABLED (BESTTIME_API_KEY_PRIVATE not set)
Worker started
```

---

## Troubleshooting

### "No venue_id returned"

**Cause**: BestTime couldn't find venue with that name/address.

**Solution**:
- Use more specific venue names
- Add full address including city/state
- Try well-known popular venues first (Times Square, Eiffel Tower, etc.)

### "BestTime API returned 401"

**Cause**: Invalid API key or wrong key type.

**Solution**:
- Ensure you're using **PRIVATE** key (starts with `pri_`)
- Not public key (`pub_`)
- Check key is copied correctly

### "Rate limit exceeded"

**Cause**: Too many requests too fast.

**Solution**:
- Reduce MAX_CROWD_VENUES_PER_TRIP (default 8)
- Increase CROWD_POLL_INTERVAL_SEC (default 300)
- Worker already has 200ms delay between requests

### "No busyness data for venue"

**Cause**: BestTime doesn't have live or forecasted data for this venue.

**Solution**:
- This is normal for less popular venues
- Worker logs warning and skips the venue
- Try more popular tourist attractions

---

## Success Criteria

✅ Worker logs show "Fetching forecast" for each venue  
✅ Worker logs show cached venue_id  
✅ Worker logs show "Fetching live data"  
✅ Worker logs show busyNow percentage (live or forecasted)  
✅ GET `/trip/:id/signals` returns crowds array with busyNow + peakHours  
✅ If busyNow >= 85 or scheduled during peak → suggestions generated  
✅ SSE events emit `signal:update` and `suggestion:new`  
✅ Web UI shows crowd percentages in Signals panel  
✅ Web UI shows crowd-based suggestions  

---

## Rate Limits

BestTime API limits:
- **10 requests/second** (worker uses 5 req/sec with 200ms delay)
- **Daily limits** vary by plan
- Worker caches venue_id to reduce forecast calls

Worker optimizations:
- MAX_CROWD_VENUES_PER_TRIP=8 (only poll 8 venues per trip)
- CROWD_POLL_INTERVAL_SEC=300 (poll every 5 minutes)
- Venue caching (only call forecast once per venue)
- 200ms delay between API calls

---

## API Endpoints

### GET /trip/:tripId/signals
```json
{
  "weather": {
    "summary": "Clear skies expected",
    "riskHours": []
  },
  "crowds": [
    {
      "placeId": "place_1",
      "placeName": "Times Square",
      "busyNow": 95,
      "peakHours": ["12:00", "13:00", "14:00"]
    }
  ]
}
```

### POST /internal/trip/:tripId/signals/crowds
```json
{
  "observedAt": "2026-02-21T10:30:00Z",
  "crowds": [
    {
      "placeId": "place_1",
      "placeName": "Times Square",
      "busyNow": 95,
      "peakHours": ["12:00", "13:00", "14:00"]
    }
  ],
  "raw": { "source": "worker-besttime" }
}
```

### GET /trip/:tripId/suggestions
```json
{
  "suggestions": [
    {
      "suggestionId": "sug_abc123",
      "kind": "shift",
      "reasons": [
        "Times Square is very busy around 12:00, 13:00 (live busyness 95%)",
        "Shifted crowded stops earlier to avoid peak hours"
      ],
      "benefit": {
        "crowdExposureReduced": 0.6
      },
      "beforePlan": { "items": [...] },
      "afterPlan": { "items": [...] }
    }
  ]
}
```

---

Ready to test! Get your BestTime PRIVATE API key and restart the services.
