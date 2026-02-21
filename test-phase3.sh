#!/bin/bash

# Phase 3 Integration Test Script
# Start the API server with: pnpm dev:api
# Then run this script in another terminal

API_BASE="http://localhost:8080"

echo "🧪 Phase 3 Integration Tests"
echo "=================================================="
echo ""

# Test 1: Health check
echo "ℹ️  Testing health check..."
HEALTH=$(curl -s "$API_BASE/health")
echo "$HEALTH" | grep -q "ok" && echo "✅ Health check passed" || echo "❌ Health check failed"
echo ""

# Test 2: Create trip
echo "ℹ️  Creating test trip..."
TRIP_RESPONSE=$(curl -s -X POST "$API_BASE/trip" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "San Francisco",
    "date": "2026-02-22",
    "startTime": "09:00",
    "endTime": "18:00",
    "preferences": {
      "pace": "moderate",
      "budget": "medium",
      "interests": ["culture", "food"]
    }
  }')

TRIP_ID=$(echo "$TRIP_RESPONSE" | grep -o '"tripId":"[^"]*"' | cut -d'"' -f4)
echo "✅ Trip created: $TRIP_ID"
echo ""

# Test 3: Add activities
echo "ℹ️  Adding test activities..."
curl -s -X POST "$API_BASE/trip/$TRIP_ID/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "activities": [
      {
        "place": {
          "provider": "foursquare",
          "providerPlaceId": "test_1",
          "name": "Golden Gate Park",
          "lat": 37.7694,
          "lng": -122.4862,
          "category": "Park",
          "isIndoor": false
        },
        "durationMin": 90,
        "locked": false
      },
      {
        "place": {
          "provider": "foursquare",
          "providerPlaceId": "test_2",
          "name": "Alcatraz Island",
          "lat": 37.8267,
          "lng": -122.423,
          "category": "Historic Site",
          "isIndoor": false
        },
        "durationMin": 120,
        "locked": false
      }
    ]
  }' > /dev/null
echo "✅ Activities added"
echo ""

# Test 4: Generate itinerary
echo "ℹ️  Generating itinerary..."
ITINERARY=$(curl -s -X POST "$API_BASE/trip/$TRIP_ID/itinerary/generate" \
  -H "Content-Type: application/json" \
  -d '{"mode": "driving"}')
echo "$ITINERARY" | grep -q "version" && echo "✅ Itinerary generated" || echo "❌ Itinerary generation failed"
echo ""

# Test 5: Get all trips
echo "ℹ️  Testing GET /trips..."
TRIPS=$(curl -s "$API_BASE/trips")
echo "$TRIPS"
echo ""

# Test 6: Get weather signals (should be empty)
echo "ℹ️  Testing GET /trip/:tripId/signals..."
SIGNALS=$(curl -s "$API_BASE/trip/$TRIP_ID/signals")
echo "$SIGNALS"
echo ""

# Test 7: Post weather signal
echo "ℹ️  Testing POST /internal/trip/:tripId/signals/weather..."
curl -s -X POST "$API_BASE/internal/trip/$TRIP_ID/signals/weather" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Rain risk between 14:00–17:00",
    "riskHours": ["14:00", "15:00", "16:00", "17:00"],
    "raw": {
      "list": [
        {
          "dt": 1771670400,
          "dt_txt": "2026-02-22 14:00:00",
          "main": {"temp": 15, "feels_like": 14, "humidity": 80},
          "weather": [{"main": "Rain", "description": "light rain"}],
          "pop": 0.8
        }
      ]
    }
  }' > /dev/null
echo "✅ Weather signal posted"
echo ""

# Test 8: Verify weather signal
echo "ℹ️  Verifying weather signal..."
SIGNALS=$(curl -s "$API_BASE/trip/$TRIP_ID/signals")
echo "$SIGNALS"
echo ""

# Test 9: Trigger recompute
echo "ℹ️  Testing POST /internal/trip/:tripId/recompute..."
RECOMPUTE=$(curl -s -X POST "$API_BASE/internal/trip/$TRIP_ID/recompute" \
  -H "Content-Type: application/json")
echo "$RECOMPUTE"
echo ""

# Test 10: Get suggestions
echo "ℹ️  Testing GET /trip/:tripId/suggestions..."
SUGGESTIONS=$(curl -s "$API_BASE/trip/$TRIP_ID/suggestions")
echo "$SUGGESTIONS"
echo ""

echo "=================================================="
echo ""
echo "✅ All tests completed!"
echo ""
echo "ℹ️  Test trip ID: $TRIP_ID"
echo "ℹ️  View in web UI: http://localhost:3000/trip/$TRIP_ID"
echo ""
