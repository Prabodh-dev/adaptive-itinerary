#!/bin/bash

# Quick Weather Test for Chennai Trip
# Run this with: bash test-weather.sh <TRIP_ID>

TRIP_ID=$1
API_BASE="http://localhost:8080"

if [ -z "$TRIP_ID" ]; then
  echo "❌ Usage: bash test-weather.sh <TRIP_ID>"
  echo ""
  echo "To get your trip ID:"
  echo "1. Look at the URL in your browser: http://localhost:3000/trip/trp_xxxxx"
  echo "2. Or run: curl http://localhost:8080/trips"
  exit 1
fi

echo "🧪 Testing Weather for Trip: $TRIP_ID"
echo "=================================================="
echo ""

# Get trip data
echo "ℹ️  Fetching trip data..."
TRIP_DATA=$(curl -s "$API_BASE/trip/$TRIP_ID")
echo "$TRIP_DATA" | jq '.' 2>/dev/null || echo "$TRIP_DATA"
echo ""

# Post mock weather signal with rain risk during itinerary time
echo "ℹ️  Posting weather signal (rain risk 21:00-22:00)..."
curl -s -X POST "$API_BASE/internal/trip/$TRIP_ID/signals/weather" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Rain risk between 21:00–22:00",
    "riskHours": ["21:00", "21:30", "22:00"],
    "raw": {
      "list": [
        {
          "dt": 1771771200,
          "dt_txt": "2026-02-22 21:00:00",
          "main": {"temp": 28, "feels_like": 32, "humidity": 85},
          "weather": [{"main": "Rain", "description": "moderate rain"}],
          "pop": 0.85
        }
      ]
    }
  }'
echo ""
echo "✅ Weather signal posted"
echo ""

# Verify weather signal
echo "ℹ️  Verifying weather signal..."
SIGNALS=$(curl -s "$API_BASE/trip/$TRIP_ID/signals")
echo "$SIGNALS" | jq '.' 2>/dev/null || echo "$SIGNALS"
echo ""

# Trigger recompute
echo "ℹ️  Triggering suggestion recompute..."
RECOMPUTE=$(curl -s -X POST "$API_BASE/internal/trip/$TRIP_ID/recompute" \
  -H "Content-Type: application/json")
echo "$RECOMPUTE" | jq '.' 2>/dev/null || echo "$RECOMPUTE"
echo ""

# Get suggestions
echo "ℹ️  Fetching suggestions..."
SUGGESTIONS=$(curl -s "$API_BASE/trip/$TRIP_ID/suggestions")
echo "$SUGGESTIONS" | jq '.' 2>/dev/null || echo "$SUGGESTIONS"
echo ""

echo "=================================================="
echo "✅ Test complete!"
echo ""
echo "📋 Next steps:"
echo "1. Refresh your browser at: http://localhost:3000/trip/$TRIP_ID"
echo "2. Weather panel should show: 🌧️ Rain risk between 21:00–22:00"
echo "3. Suggestions panel should show a REORDER suggestion if outdoor activities overlap"
echo ""
