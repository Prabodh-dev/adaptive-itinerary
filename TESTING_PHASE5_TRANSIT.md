# Phase 5 - Transit Delays & Service Alerts Testing Guide

## Prerequisites

### 1. Get GTFS-Realtime Feed URLs

You need URLs for GTFS-Realtime feeds from a transit agency. Some agencies require API keys, others have open feeds.

**Free/Open GTFS-RT Feeds:**

- **BART (Bay Area)**: https://api.bart.gov/gtfsrt/tripupdate.aspx (no key needed)
- **SF Muni**: Various feeds at https://511.org/
- **Seattle Sound Transit**: https://s3.amazonaws.com/kcm-alerts-realtime-prod/tripupdates.pb
- **Portland TriMet**: https://developer.trimet.org/ws/gtfs-realtime/ (requires API key)

**Requires API Key:**

- **NYC MTA**: https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/ (register at https://api.mta.info/)
- **WMATA (DC Metro)**: https://developer.wmata.com/
- **Chicago CTA**: https://www.transitchicago.com/developers/

### 2. Update .env

```bash
# Add to .env
GTFSRT_TRIPUPDATES_URL=https://api.bart.gov/gtfsrt/tripupdate.aspx
GTFSRT_ALERTS_URL=https://api.bart.gov/gtfsrt/alerts.aspx
TRANSIT_POLL_INTERVAL_SEC=180
TRANSIT_DELAY_THRESHOLD_MIN=10
```

**Optional: Leave URLs blank to disable transit monitoring**

```bash
GTFSRT_TRIPUPDATES_URL=
GTFSRT_ALERTS_URL=
```

### 3. Restart Services

```bash
# Stop current services (Ctrl+C)
pnpm dev
```

---

## How It Works

### Worker Flow

1. **Every 3 minutes** (TRANSIT_POLL_INTERVAL_SEC=180):
   - Worker fetches trip updates feed (if URL set)
   - Worker fetches service alerts feed (if URL set)

2. **Parse GTFS-RT data**:
   - **Trip Updates**: Extract numeric delays from stop_time_update (seconds → minutes)
   - **Service Alerts**: Infer delay from effect enum:
     - `NO_SERVICE` → 60 min
     - `SIGNIFICANT_DELAYS` → 15 min
     - `DELAYS` → 5 min
     - `OTHER_EFFECT` → 3 min

3. **Merge alerts**:
   - Combine trip updates + service alerts
   - Deduplicate by route/line
   - Sort by delay (highest first)
   - Keep top 5 alerts

4. **Post transit signals**:
   - POST `/internal/trip/:tripId/signals/transit`
   - Body: `{ observedAt, transit: { alerts: [{ line, delayMin, message }] } }`
   - SSE emits `signal:update` event

5. **Trigger recompute**:
   - POST `/internal/trip/:tripId/recompute`
   - Calls `buildTransitSuggestion()`
   - If any delay >= 10 min threshold → create "reorder" suggestion
   - SSE emits `suggestion:new` event

---

## Testing Steps

### Test 1: Manual API Test (Demo Data)

**Test without real GTFS-RT feed:**

```bash
# 1. Create a trip
$trip = Invoke-RestMethod -Uri "http://localhost:8080/trip" -Method Post -Body (@{
  city="San Francisco"
  date="2026-02-22"
  startTime="09:00"
  endTime="22:00"
  preferences=@{pace="medium";interests=@("culture");avoid=@();budget="medium"}
} | ConvertTo-Json -Depth 10) -ContentType "application/json"
$tripId = $trip.tripId
Write-Host "Trip: $tripId"

# 2. Add activities
Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/activities" -Method Post -Body (@{
  activities=@(
    @{
      place=@{
        provider="foursquare"
        providerPlaceId="place_1"
        name="Golden Gate Bridge"
        lat=37.8199
        lng=-122.4783
        address="Golden Gate Bridge, San Francisco, CA"
        category="Tourist Attraction"
      }
      durationMin=60
      locked=$false
    },
    @{
      place=@{
        provider="foursquare"
        providerPlaceId="place_2"
        name="Fisherman's Wharf"
        lat=37.8080
        lng=-122.4177
        address="Fisherman's Wharf, San Francisco, CA"
        category="Tourist Attraction"
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

# 4. Manually inject transit alerts (simulate worker)
Invoke-RestMethod -Uri "http://localhost:8080/internal/trip/$tripId/signals/transit" -Method Post -Body (@{
  observedAt=(Get-Date).ToUniversalTime().ToString("o")
  transit=@{
    alerts=@(
      @{
        line="BART Red Line"
        delayMin=15
        message="Significant delays due to track maintenance"
      },
      @{
        line="Muni N-Judah"
        delayMin=8
        message="Minor delays in outbound direction"
      }
    )
  }
} | ConvertTo-Json -Depth 10) -ContentType "application/json"

# 5. Check signals
$signals = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/signals"
$signals.transit.alerts | Format-Table

# 6. Check suggestions (should see transit-based suggestion)
$suggestions = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/suggestions"
$suggestions.suggestions | ConvertTo-Json -Depth 10
```

**Expected Result:**
- Signals should show 2 transit alerts
- Suggestions should include a "reorder" suggestion citing BART Red Line delay (15 min >= 10 min threshold)
- Suggestion should reorder first 1-2 non-locked activities to give buffer time

---

### Test 2: Real GTFS-RT Feed Test

**Test with live BART data:**

1. **Update .env** with BART feeds:
   ```bash
   GTFSRT_TRIPUPDATES_URL=https://api.bart.gov/gtfsrt/tripupdate.aspx
   GTFSRT_ALERTS_URL=https://api.bart.gov/gtfsrt/alerts.aspx
   ```

2. **Restart services**: `pnpm dev`

3. **Watch worker logs** for transit polling:
   ```
   [Transit] Polling transit data...
   [Transit] Found 1 trips
   [Transit] Fetching trip updates feed...
   [Transit] Extracted 12 delays from trip updates
   [Transit] Fetching service alerts feed...
   [Transit] Extracted 3 service alerts
   [Transit][trp_abc123] Posted 5 transit alerts
   [Transit][trp_abc123] Recompute triggered
   [Transit] Polling cycle complete
   ```

4. **Check signals** via API or Web UI

---

### Test 3: Web UI Test

1. **Open** http://localhost:3000
2. **Create trip**: Select a city with transit (SF, NYC, Chicago, etc.)
3. **Add activities**: Add 3-5 tourist spots
4. **Generate itinerary**
5. **Wait 3 minutes** for worker to poll transit feeds
6. **Check Signals panel**: Should show transit alerts section with:
   - Transit icon 🚇
   - Line name (e.g., "BART Red Line")
   - Delay in minutes
   - Alert message
   - Color coding:
     - Green: < 5 min
     - Yellow: 5-9 min
     - Red: >= 10 min
7. **Check Suggestions**: If any delay >= 10 min, should see transit-based suggestion

---

## Expected Worker Logs

### Successful Polling (with real feed)

```
[Transit] Polling transit data...
[Transit] Found 1 trips
[Transit] Fetching trip updates feed...
[Transit] Extracted 12 delays from trip updates
[Transit] Fetching service alerts feed...
[Transit] Extracted 3 service alerts
[Transit][trp_abc123] Posted 5 transit alerts
[Transit][trp_abc123] Recompute triggered
[Transit] Polling cycle complete
```

### No Feeds Configured

```
=== Weather, Crowd & Transit Worker ===
API URL: http://localhost:8080
Weather poll interval: 120s
Crowd poll interval: 300s
Transit poll interval: 180s
Crowd detection: ✓ ENABLED (BestTime real API)
Transit monitoring: ✗ DISABLED (no GTFS-RT feed URLs set)
Worker started
```

### Empty Feed (no delays)

```
[Transit] Polling transit data...
[Transit] Found 1 trips
[Transit] Fetching trip updates feed...
[Transit] Extracted 0 delays from trip updates
[Transit] Fetching service alerts feed...
[Transit] Extracted 0 service alerts
[Transit] No significant transit alerts found
[Transit][trp_abc123] Posted 0 transit alerts
[Transit] Polling cycle complete
```

---

## Troubleshooting

### "Failed to fetch GTFS-RT feed"

**Cause**: Invalid URL, network error, or API key required.

**Solution**:
- Verify URL is correct
- Check if API key is needed
- Test URL in browser or Postman
- Try a different feed (BART doesn't require API key)

### "No delays extracted"

**Cause**: Feed is empty or has no current delays.

**Solution**:
- This is normal if transit is running smoothly
- Try during peak hours when delays are more common
- Use manual POST test to simulate delays

### "Transit suggestions not generated"

**Cause**: All delays < 10 min threshold.

**Solution**:
- Lower TRANSIT_DELAY_THRESHOLD_MIN in .env
- Manually inject higher delays via POST test
- Wait for real delays during peak hours

### "Worker crashes on transit poll"

**Cause**: Malformed protobuf feed or unexpected data structure.

**Solution**:
- Check worker logs for error details
- Verify feed URL returns valid protobuf data
- Try a different feed provider
- Report issue with feed structure

---

## Success Criteria

✅ Worker logs show "Fetching trip updates feed" and "Fetching service alerts feed"  
✅ Worker logs show extracted delays/alerts count  
✅ Worker logs show "Posted X transit alerts"  
✅ GET `/trip/:id/signals` returns transit object with alerts array  
✅ If any delay >= 10 min → suggestions generated  
✅ SSE events emit `signal:update` and `suggestion:new`  
✅ Web UI shows transit alerts in Signals panel  
✅ Web UI shows transit-based suggestions with color coding  

---

## Rate Limits

GTFS-Realtime feeds:
- **Most feeds**: No explicit rate limits (designed for real-time polling)
- **Recommended**: Poll every 30-180 seconds
- **Worker default**: 180 seconds (3 minutes)

Worker optimizations:
- TRANSIT_POLL_INTERVAL_SEC=180 (poll every 3 minutes)
- Gracefully skips if feed URLs are blank
- Fetches feeds once per poll (not per trip)
- Same alerts sent to all trips in same city

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
  ],
  "transit": {
    "alerts": [
      {
        "line": "BART Red Line",
        "delayMin": 15,
        "message": "Significant delays due to track maintenance"
      },
      {
        "line": "Muni N-Judah",
        "delayMin": 8,
        "message": "Minor delays in outbound direction"
      }
    ]
  }
}
```

### POST /internal/trip/:tripId/signals/transit
```json
{
  "observedAt": "2026-02-21T10:30:00Z",
  "transit": {
    "alerts": [
      {
        "line": "BART Red Line",
        "delayMin": 15,
        "message": "Significant delays due to track maintenance"
      }
    ]
  }
}
```

### GET /trip/:tripId/suggestions
```json
{
  "suggestions": [
    {
      "suggestionId": "sug_abc123",
      "kind": "reorder",
      "reasons": [
        "BART Red Line: 15-min delays (track maintenance)",
        "Reordering activities to provide buffer time"
      ],
      "benefit": {
        "delayAvoidedMin": 15
      },
      "beforePlan": { "items": [...] },
      "afterPlan": { "items": [...] }
    }
  ]
}
```

---

## GTFS-Realtime Resources

- **Official Spec**: https://gtfs.org/realtime/
- **Feed Directory**: https://transitfeeds.com/
- **Feed Validator**: https://gtfs-validator.mobilitydata.org/
- **BART API**: https://www.bart.gov/schedules/developers/gtfs-realtime
- **NYC MTA API**: https://api.mta.info/

---

Ready to test! Configure GTFS-RT feed URLs in .env and restart the services.
