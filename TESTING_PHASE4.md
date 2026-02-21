# Phase 4 - Crowd Monitoring Testing Guide

This guide explains how to test the Phase 4 crowd monitoring and adaptation features.

## Overview

Phase 4 adds:
- **BestTime API integration** for crowd/busyness data
- **Crowd signals** storage per trip (per place)
- **Crowd-based suggestions** when places are too busy
- **Worker crowd polling** that runs periodically
- **SSE updates** for real-time crowd signal changes

## Prerequisites

1. **API server running** on `http://localhost:8080`
2. **Test trip created** with activities
3. **(Optional) BestTime API key** - Falls back to mock data if not set

## Setup

### 1. Configure BestTime API Key (Optional)

Edit `.env`:
```bash
BESTTIME_API_KEY=your_key_here
CROWD_POLL_INTERVAL_SEC=180  # 3 minutes
```

If no API key is set, the system uses fallback mock data (busyNow: 20-80, peakHours: ["17:00", "18:00"]).

### 2. Start Services

```bash
# Start API + Web + Worker
pnpm dev

# Or start individually
pnpm dev:api     # API server
pnpm dev:web     # Web UI
pnpm dev:worker  # Weather & Crowd worker
```

## Testing Phase 4

### Method 1: Automated Test Script (PowerShell)

```powershell
# Create test trip first
.\create-test-trip.sh

# Run Phase 4 test
.\test-phase4.ps1 -TripId trp_YOUR_TRIP_ID
```

This script will:
1. ✅ Verify trip exists
2. ✅ Get current signals (should include empty crowds array initially)
3. ✅ Post mock crowd data for 2 places
4. ✅ Verify signals updated with crowd data
5. ✅ Trigger recompute to generate crowd suggestions
6. ✅ Display suggestions (should include crowd-based "shift" suggestion)

### Method 2: Manual Testing with curl

#### Step 1: Create Test Trip

```bash
# Create trip
curl -X POST http://localhost:8080/trip -H "Content-Type: application/json" -d '{
  "city": "Chennai",
  "date": "2026-02-27",
  "startTime": "09:00",
  "endTime": "22:00",
  "preferences": {
    "pace": "medium",
    "interests": ["culture", "food"],
    "avoid": [],
    "budget": "medium"
  }
}'

# Add activities
curl -X POST http://localhost:8080/trip/YOUR_TRIP_ID/activities -H "Content-Type: application/json" -d '{
  "activities": [
    {
      "place": {
        "provider": "foursquare",
        "providerPlaceId": "place_1",
        "name": "Marina Beach",
        "lat": 13.0477,
        "lng": 80.2807,
        "category": "Beach",
        "isIndoor": false
      },
      "durationMin": 60,
      "locked": false
    },
    {
      "place": {
        "provider": "foursquare",
        "providerPlaceId": "place_2",
        "name": "Phoenix Market City",
        "lat": 13.0827,
        "lng": 80.2707,
        "category": "Shopping Mall",
        "isIndoor": true
      },
      "durationMin": 90,
      "locked": false
    }
  ]
}'

# Generate itinerary
curl -X POST http://localhost:8080/trip/YOUR_TRIP_ID/itinerary -H "Content-Type: application/json" -d '{
  "mode": "driving",
  "optimizeOrder": true
}'
```

#### Step 2: Check Initial Signals

```bash
curl http://localhost:8080/trip/YOUR_TRIP_ID/signals | jq '.'
```

Expected output:
```json
{
  "weather": {
    "summary": "No data yet",
    "riskHours": []
  },
  "crowds": []
}
```

#### Step 3: Post Crowd Signals

```bash
curl -X POST http://localhost:8080/internal/trip/YOUR_TRIP_ID/signals/crowds \
  -H "Content-Type: application/json" \
  -d '{
    "observedAt": "2026-02-27T10:00:00Z",
    "crowds": [
      {
        "placeId": "place_1",
        "placeName": "Marina Beach",
        "busyNow": 85,
        "peakHours": ["17:00", "18:00", "19:00"]
      },
      {
        "placeId": "place_2",
        "placeName": "Phoenix Market City",
        "busyNow": 65,
        "peakHours": ["12:00", "13:00"]
      }
    ],
    "raw": {
      "source": "manual-test"
    }
  }' | jq '.'
```

Expected output:
```json
{ "ok": true }
```

#### Step 4: Verify Signals Updated

```bash
curl http://localhost:8080/trip/YOUR_TRIP_ID/signals | jq '.crowds'
```

Expected output:
```json
[
  {
    "placeId": "place_1",
    "placeName": "Marina Beach",
    "busyNow": 85,
    "peakHours": ["17:00", "18:00", "19:00"]
  },
  {
    "placeId": "place_2",
    "placeName": "Phoenix Market City",
    "busyNow": 65,
    "peakHours": ["12:00", "13:00"]
  }
]
```

#### Step 5: Trigger Recompute

```bash
curl -X POST http://localhost:8080/internal/trip/YOUR_TRIP_ID/recompute | jq '.'
```

Expected output:
```json
{
  "ok": true,
  "suggestions": [
    {
      "suggestionId": "sug_...",
      "kind": "shift",
      "reasons": [
        "Marina Beach is very busy right now (85% capacity)",
        "Shifted crowded stops earlier to avoid peak hours"
      ],
      "benefit": {
        "crowdExposureReduced": 0.6
      },
      "beforePlan": { ... },
      "afterPlan": { ... }
    }
  ]
}
```

#### Step 6: Get Suggestions

```bash
curl http://localhost:8080/trip/YOUR_TRIP_ID/suggestions | jq '.'
```

## Understanding Crowd Suggestions

### When Suggestions Are Generated

A crowd suggestion is created when:
1. **busyNow >= 80** - Place is currently very busy (80%+ capacity)
2. **OR scheduled during peakHours** - Activity is scheduled within ±1 hour of peak hours

### Suggestion Logic

- **Kind**: `shift` - Indicates time shifting to avoid crowds
- **Reasons**: Explains which places are busy and when
- **afterPlan**: Moves crowded activities earlier in the itinerary
- **Respects locked activities**: Locked activities stay in their positions

Example reasons:
```
- "Marina Beach is very busy right now (85% capacity)"
- "Phoenix Market City is predicted very busy around 17:00, 18:00"
- "Shifted crowded stops earlier to avoid peak hours"
```

## Worker Behavior

The worker polls crowd data every `CROWD_POLL_INTERVAL_SEC` seconds (default: 180s / 3 minutes).

For each trip:
1. ✅ Fetches all activities
2. ✅ Calls BestTime API for each place (max 8 to avoid rate limits)
3. ✅ Posts crowd signals to API
4. ✅ Triggers recompute to generate suggestions
5. ✅ Emits SSE event `signal:update` for real-time updates

### Worker Logs

```
[Crowds] Polling crowd data...
[Crowds] Found 1 trips
[Crowds][trp_xyz] Fetching crowd data for 2 places (max 8)...
[Crowds][trp_xyz] Marina Beach: 85% busy, peak 17:00, 18:00
[Crowds][trp_xyz] Phoenix Market City: 65% busy, peak 12:00, 13:00
[Crowds][trp_xyz] Crowd signals posted
[Crowds][trp_xyz] Recompute triggered
[Crowds] Polling cycle complete
```

## API Endpoints

### Public Endpoints

#### `GET /trip/:tripId/signals`
Returns both weather and crowd signals.

Response:
```json
{
  "weather": {
    "summary": "string",
    "riskHours": ["HH:mm"]
  },
  "crowds": [
    {
      "placeId": "string",
      "placeName": "string",
      "busyNow": 0-100,
      "peakHours": ["HH:mm"]
    }
  ]
}
```

#### `GET /trip/:tripId/suggestions`
Returns all suggestions (weather + crowd based).

### Internal Endpoints (Worker Only)

#### `POST /internal/trip/:tripId/signals/crowds`
Updates crowd signals for a trip.

Request:
```json
{
  "observedAt": "ISO-8601 timestamp",
  "crowds": [
    {
      "placeId": "string",
      "placeName": "string",
      "busyNow": 0-100,
      "peakHours": ["HH:mm"]
    }
  ],
  "raw": {}
}
```

#### `POST /internal/trip/:tripId/recompute`
Triggers suggestion recomputation (weather + crowd).

## Web UI Integration

The existing Phase 3 web UI automatically displays:
- ✅ **SignalsPanel** - Shows crowd data alongside weather
- ✅ **SuggestionCard** - Displays crowd-based suggestions
- ✅ **SSE updates** - Real-time updates when crowd signals change

No frontend changes needed - Phase 4 is fully backward compatible!

## Troubleshooting

### "Crowds array is empty"
- Worker may not have run yet (wait for poll interval)
- Check worker logs for errors
- Verify activities have `providerPlaceId` set

### "No crowd suggestions generated"
- Check if activities are scheduled during peak hours
- Verify busyNow >= 80 or activity overlaps with peakHours
- Check recompute endpoint logs

### "BestTime API errors"
- Verify API key is valid
- System falls back to mock data (20-80% busy, peak 17:00-18:00)
- Check rate limits (worker limits to 8 places per trip)

## Success Criteria

✅ **Signals endpoint** returns crowds array with place data  
✅ **Crowd suggestions** generated when places are busy  
✅ **SSE events** emitted on crowd signal updates  
✅ **Worker** polls crowds periodically  
✅ **Web UI** displays crowd data in signals panel  
✅ **Fallback mode** works without BestTime API key  

## Next Steps

- **Phase 5**: Add suggestion status management (pending/accepted/dismissed)
- **Phase 6**: Add database persistence (PostgreSQL/MongoDB)
- **Phase 7**: Multi-day itineraries and advanced optimization

---

**Phase 4 Complete!** 🎉

The system now monitors both weather AND crowd conditions, providing intelligent suggestions to optimize your itinerary.
