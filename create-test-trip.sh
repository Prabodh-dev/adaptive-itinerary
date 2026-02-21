#!/bin/bash

# Quick script to recreate Chennai test trip
# Run this after server restart to get a working trip

API_BASE="http://localhost:8080"

echo "🚀 Creating Chennai test trip..."
echo ""

# Create trip
TRIP_RESPONSE=$(curl -s -X POST "$API_BASE/trip" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "chennai",
    "date": "2026-02-22",
    "startTime": "19:15",
    "endTime": "23:21",
    "preferences": {
      "pace": "medium",
      "interests": [],
      "avoid": [],
      "budget": "medium"
    }
  }')

TRIP_ID=$(echo "$TRIP_RESPONSE" | grep -o '"tripId":"[^"]*"' | cut -d'"' -f4)
echo "✅ Trip created: $TRIP_ID"
echo ""

# Add activities (outdoor activities for weather testing)
echo "📍 Adding activities..."
curl -s -X POST "$API_BASE/trip/$TRIP_ID/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "activities": [
      {
        "place": {
          "provider": "foursquare",
          "providerPlaceId": "4d046ec926adb1f721c3d270",
          "name": "Marina Beach",
          "lat": 13.047662900808886,
          "lng": 80.2806979251197,
          "category": "Beach",
          "address": "Santhome High Rd (Kamaraj Salai), Chennai 600 005, Tamil Nadu",
          "isIndoor": false
        },
        "durationMin": 30,
        "locked": true
      },
      {
        "place": {
          "provider": "foursquare",
          "providerPlaceId": "519b51d6454ac02c75edaf61",
          "name": "Celio Phoenix Market City",
          "lat": 13.086542713196428,
          "lng": 80.2824854850769,
          "category": "Mens Store",
          "address": "Phoenix Marketcity Chennai, Chennai 600042, Tamil Nadu",
          "isIndoor": true
        },
        "durationMin": 30,
        "locked": false
      },
      {
        "place": {
          "provider": "foursquare",
          "providerPlaceId": "625bffbfb5a34fdeb19f893f",
          "name": "Chennai :Guindy",
          "lat": 13.071831,
          "lng": 80.201683,
          "address": "600016, Tamil Nadu",
          "isIndoor": false
        },
        "durationMin": 60,
        "locked": false
      },
      {
        "place": {
          "provider": "foursquare",
          "providerPlaceId": "4e17dac152b123a586d18909",
          "name": "SRM University",
          "lat": 13.082516264725097,
          "lng": 80.27373627291391,
          "category": "Structure",
          "address": "Chennai, Tamil Nadu",
          "isIndoor": false
        },
        "durationMin": 60,
        "locked": false
      }
    ]
  }' > /dev/null

echo "✅ Activities added (2 indoor, 2 outdoor)"
echo ""

# Generate itinerary
echo "🗓️  Generating itinerary..."
curl -s -X POST "$API_BASE/trip/$TRIP_ID/itinerary/generate" \
  -H "Content-Type: application/json" \
  -d '{"mode": "driving"}' > /dev/null

echo "✅ Itinerary generated"
echo ""

# Post weather signal
echo "🌧️  Posting weather signal..."
curl -s -X POST "$API_BASE/internal/trip/$TRIP_ID/signals/weather" \
  -H "Content-Type: application/json" \
  -d '{
    "observedAt": "2026-02-22T21:00:00Z",
    "weather": {
      "summary": "Rain risk between 21:00–22:30",
      "riskHours": ["21:00", "21:30", "22:00", "22:30"]
    },
    "raw": {}
  }' > /dev/null

echo "✅ Weather signal posted"
echo ""

# Trigger recompute
echo "💡 Generating suggestions..."
curl -s -X POST "$API_BASE/internal/trip/$TRIP_ID/recompute" > /dev/null

echo "✅ Suggestions generated"
echo ""

echo "=================================================="
echo ""
echo "🎉 Test trip ready!"
echo ""
echo "📋 Trip ID: $TRIP_ID"
echo ""
echo "🌐 Open in browser:"
echo "   http://localhost:3000/trip/$TRIP_ID"
echo ""
echo "🧪 Test SSE stream:"
echo "   curl -N http://localhost:8080/trip/$TRIP_ID/stream"
echo ""
echo "📊 Get weather signals:"
echo "   curl http://localhost:8080/trip/$TRIP_ID/signals"
echo ""
echo "💡 Get suggestions:"
echo "   curl http://localhost:8080/trip/$TRIP_ID/suggestions"
echo ""
