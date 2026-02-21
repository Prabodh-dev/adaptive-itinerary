# Testing Guide: Transitland Integration & Travel Modes

This guide covers testing the Transitland-based transit monitoring and mode-aware travel times (walking, driving with traffic).

## Overview

**What Changed:**
- ✅ Replaced GTFS-Realtime with **Transitland** (single API for all cities globally)
- ✅ Added **walking mode** with accurate walking travel times
- ✅ Added **driving-traffic mode** with real-time traffic-aware estimates
- ✅ Automatic fallback from driving-traffic to driving when >10 coordinates

## Prerequisites

1. **Required API Keys:**
   - `MAPBOX_ACCESS_TOKEN` - For travel time matrix (all modes)
   - `TRANSITLAND_API_KEY` - For transit delays/alerts (optional)
   - Get free Transitland key at: https://www.transit.land/

2. **Optional API Keys:**
   - `OPENWEATHER_API_KEY` - Weather monitoring
   - `BESTTIME_API_KEY_PRIVATE` - Crowd monitoring

## Environment Setup

Update your `.env` file:

```bash
# Required
MAPBOX_ACCESS_TOKEN=pk.your_token_here

# Optional (for transit monitoring)
TRANSITLAND_API_KEY=your_transitland_key_here
TRANSITLAND_BASE_URL=https://transit.land/api/v2/rest
TRANSIT_POLL_INTERVAL_SEC=180
TRANSIT_DELAY_THRESHOLD_MIN=10
TRANSIT_STOPS_RADIUS_M=800
TRANSIT_MAX_STOPS=3
TRANSIT_NEXT_SECONDS=3600
```

## Test 1: Walking Mode Travel Times

**Test that walking mode uses realistic walking speeds:**

### Step 1: Create a trip
```powershell
$body = @{
  city = "San Francisco"
  date = "2026-03-15"
  startTime = "09:00"
  endTime = "17:00"
  preferences = @{
    pace = "medium"
    interests = @("landmarks", "culture")
    avoid = @()
    budget = "medium"
  }
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/trip" -Method POST -Body $body -ContentType "application/json"
$tripId = $response.tripId
Write-Host "Created trip: $tripId"
```

### Step 2: Add activities
```powershell
$body = @{
  activities = @(
    @{
      place = @{
        provider = "foursquare"
        providerPlaceId = "test-golden-gate"
        name = "Golden Gate Bridge"
        lat = 37.8199
        lng = -122.4783
        category = "landmark"
      }
      durationMin = 60
      locked = $false
    },
    @{
      place = @{
        provider = "foursquare"
        providerPlaceId = "test-palace-fine-arts"
        name = "Palace of Fine Arts"
        lat = 37.8024
        lng = -122.4488
        category = "landmark"
      }
      durationMin = 45
      locked = $false
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/activities" -Method POST -Body $body -ContentType "application/json"
```

### Step 3: Generate itinerary with WALKING mode
```powershell
$body = @{
  mode = "walking"
  optimizeOrder = $true
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/itinerary" -Method POST -Body $body -ContentType "application/json"
$response.itinerary.items | Format-Table activityId, placeName, startTime, endTime, travelFromPrevMin
```

### Expected Results:
- ✅ Travel times should be **larger** than driving mode (walking is slower)
- ✅ For ~3km distance: expect 35-45 minutes walking
- ✅ Check console logs: should show "mapbox/walking" profile

### Step 4: Compare with driving mode
```powershell
$body = @{
  mode = "driving"
  optimizeOrder = $true
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/itinerary" -Method POST -Body $body -ContentType "application/json"
$response.itinerary.items | Format-Table activityId, placeName, startTime, endTime, travelFromPrevMin
```

### Expected Results:
- ✅ Travel times should be **smaller** than walking mode
- ✅ For ~3km distance: expect 8-12 minutes driving
- ✅ Check console logs: should show "mapbox/driving-traffic" profile

---

## Test 2: Driving-Traffic Mode with Fallback

**Test that driving-traffic automatically falls back to driving when >10 coordinates:**

### Setup: Create trip with 12 activities (>10 limit)
```powershell
$activities = @()
$locations = @(
  @{ name="Golden Gate Bridge"; lat=37.8199; lng=-122.4783 },
  @{ name="Palace of Fine Arts"; lat=37.8024; lng=-122.4488 },
  @{ name="Fisherman's Wharf"; lat=37.8080; lng=-122.4177 },
  @{ name="Alcatraz Island"; lat=37.8267; lng=-122.4233 },
  @{ name="Lombard Street"; lat=37.8021; lng=-122.4187 },
  @{ name="Coit Tower"; lat=37.8024; lng=-122.4058 },
  @{ name="Chinatown"; lat=37.7941; lng=-122.4078 },
  @{ name="Union Square"; lat=37.7880; lng=-122.4074 },
  @{ name="Ferry Building"; lat=37.7955; lng=-122.3937 },
  @{ name="AT&T Park"; lat=37.7786; lng=-122.3893 },
  @{ name="Mission Dolores"; lat=37.7637; lng=-122.4268 },
  @{ name="Twin Peaks"; lat=37.7544; lng=-122.4477 }
)

foreach ($loc in $locations) {
  $activities += @{
    place = @{
      provider = "test"
      providerPlaceId = "test-$($loc.name -replace ' ','-')"
      name = $loc.name
      lat = $loc.lat
      lng = $loc.lng
      category = "landmark"
    }
    durationMin = 30
    locked = $false
  }
}

$body = @{ activities = $activities } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/activities" -Method POST -Body $body -ContentType "application/json"
```

### Generate itinerary
```powershell
$body = @{
  mode = "driving"
  optimizeOrder = $true
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/itinerary" -Method POST -Body $body -ContentType "application/json"
```

### Expected Results:
- ✅ Check API console logs: should see "falling back from driving-traffic to driving (12 coords > 10)"
- ✅ Itinerary still generated successfully
- ✅ Travel times reasonable (no errors)

---

## Test 3: Transitland Transit Monitoring

**Test that Transitland integration detects nearby transit stops and alerts:**

### Step 1: Create a trip in a transit-rich area
```powershell
$body = @{
  city = "San Francisco"  # Good transit coverage
  date = "2026-03-15"
  startTime = "09:00"
  endTime = "17:00"
  preferences = @{
    pace = "medium"
    interests = @("transit", "landmarks")
    avoid = @()
    budget = "medium"
  }
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/trip" -Method POST -Body $body -ContentType "application/json"
$tripId = $response.tripId
```

### Step 2: Add activities near transit hubs
```powershell
$body = @{
  activities = @(
    @{
      place = @{
        provider = "foursquare"
        providerPlaceId = "test-embarcadero"
        name = "Embarcadero Station"
        lat = 37.7929
        lng = -122.3972
        category = "transit"
      }
      durationMin = 30
      locked = $false
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/activities" -Method POST -Body $body -ContentType "application/json"
```

### Step 3: Start worker (if not running)
```powershell
# In a separate terminal
cd apps/worker
pnpm dev
```

### Step 4: Wait for transit poll cycle (default: 180 seconds)
Check worker logs for:
```
[Transit] Polling transit data via Transitland...
[Transit] Found 1 trips
[Transit][trip_xxx] Searching for stops near 37.7929, -122.3972
[Transit][trip_xxx] Found N nearby stops
[Transit][trip_xxx] Fetching departures for stop: ...
[Transit][trip_xxx] Posted N transit alerts
```

### Step 5: Check transit signals
```powershell
$signals = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/signals"
$signals.transit
```

### Expected Results:
- ✅ `transit.alerts` array exists (may be empty if no delays)
- ✅ If delays exist: each alert has `line`, `delayMin`, `message`
- ✅ Worker logs show Transitland API calls
- ✅ If `delayMin >= 10`: suggestion created automatically

### Step 6: Check suggestions
```powershell
$suggestions = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/suggestions"
$suggestions.suggestions | Where-Object { $_.kind -eq "reorder" } | Format-List
```

### Expected Results (if significant delays):
- ✅ Suggestion with `kind = "reorder"`
- ✅ Reasons mention transit delays
- ✅ `benefit.delayAvoidedMin` shows total delay
- ✅ `afterPlan` shows reordered activities

---

## Test 4: Transit Coverage in Different Cities

**Verify Transitland works globally (not just US cities):**

### Test Cities:
1. **San Francisco, USA** (excellent coverage)
2. **New York, USA** (excellent coverage)
3. **London, UK** (good coverage)
4. **Tokyo, Japan** (good coverage)
5. **Sydney, Australia** (moderate coverage)

### For each city:
1. Create trip in that city
2. Add activities near major transit hubs
3. Wait for worker poll
4. Check `GET /trip/{id}/signals` for transit alerts

### Expected Results:
- ✅ Transitland returns stops for major cities globally
- ✅ No errors even if coverage is limited
- ✅ Empty alerts array when no transit nearby (graceful degradation)

---

## Test 5: SSE Real-Time Updates

**Test that transit alerts trigger SSE events:**

### Step 1: Open SSE stream
```powershell
# Use curl or a browser tool
curl -N http://localhost:8080/trip/$tripId/events
```

### Step 2: Wait for transit poll
After ~180 seconds, you should see:
```
event: signal:update
data: {"type":"transit","observedAt":"2026-03-15T10:30:00.000Z"}
```

### Expected Results:
- ✅ SSE event fires when transit signals update
- ✅ Web UI receives update and refreshes signals panel
- ✅ No duplicate events

---

## Troubleshooting

### Issue: No transit alerts appearing
**Solution:**
1. Check `TRANSITLAND_API_KEY` is set in `.env`
2. Check worker logs for errors
3. Verify trip activities are near transit stops (use major stations)
4. Check Transitland API directly:
   ```
   https://transit.land/api/v2/rest/stops?lat=37.7929&lon=-122.3972&radius=800&apikey=YOUR_KEY
   ```

### Issue: Walking times too short
**Solution:**
1. Check API logs for profile used (should be "mapbox/walking")
2. Verify `mode=walking` in request body
3. Check Mapbox response in logs

### Issue: Driving-traffic not falling back
**Solution:**
1. Add more activities (need >10 total)
2. Check API logs for fallback message
3. Verify Mapbox token has Matrix API access

---

## Success Criteria

✅ **Walking Mode:**
- Travel times 3-5x longer than driving
- Profile "mapbox/walking" in logs

✅ **Driving-Traffic Mode:**
- Profile "mapbox/driving-traffic" for ≤10 coords
- Auto-fallback to "mapbox/driving" for >10 coords
- No errors with large coordinate sets

✅ **Transitland Integration:**
- Worker finds nearby stops
- Fetches departures successfully
- Extracts alerts (if any)
- Posts to API and triggers recompute
- Creates suggestions when delay ≥ threshold
- Works in multiple cities globally

✅ **SSE Events:**
- Transit signal updates trigger SSE
- Web UI receives and displays alerts
- Color-coded by delay severity

---

## Next Steps

After testing:
1. Monitor performance with real trips
2. Adjust `TRANSIT_STOPS_RADIUS_M` if needed (default: 800m)
3. Adjust `TRANSIT_MAX_STOPS` for coverage vs API usage (default: 3)
4. Consider caching Transitland responses to reduce API calls
