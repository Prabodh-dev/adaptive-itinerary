#!/bin/bash

# Phase 4 - Crowd Monitoring Test Script
# Tests crowd signals, crowd-based suggestions, and SSE updates

API_URL="http://localhost:8080"

echo "=== Phase 4 - Crowd Monitoring Test ==="
echo ""

# Check if trip ID is provided
if [ -z "$1" ]; then
  echo "Usage: ./test-phase4.sh <tripId>"
  echo ""
  echo "Create a test trip first:"
  echo "./create-test-trip.sh"
  exit 1
fi

TRIP_ID=$1

echo "Testing trip: $TRIP_ID"
echo ""

# Step 1: Check trip exists
echo "1. Checking trip exists..."
TRIP_DATA=$(curl -s "$API_URL/trip/$TRIP_ID")
echo "$TRIP_DATA" | jq -r '.trip.city'
echo ""

# Step 2: Get current signals (should include crowds array)
echo "2. Getting current signals..."
curl -s "$API_URL/trip/$TRIP_ID/signals" | jq '.'
echo ""

# Step 3: Post mock crowd signals
echo "3. Posting mock crowd signals..."
CROWD_PAYLOAD=$(cat <<EOF
{
  "observedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
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
    "source": "test-script"
  }
}
EOF
)

echo "$CROWD_PAYLOAD" | jq '.'
curl -s -X POST "$API_URL/internal/trip/$TRIP_ID/signals/crowds" \
  -H "Content-Type: application/json" \
  -d "$CROWD_PAYLOAD" | jq '.'
echo ""

# Step 4: Verify signals updated
echo "4. Verifying signals include crowds..."
curl -s "$API_URL/trip/$TRIP_ID/signals" | jq '.crowds'
echo ""

# Step 5: Trigger recompute to generate crowd suggestions
echo "5. Triggering recompute..."
curl -s -X POST "$API_URL/internal/trip/$TRIP_ID/recompute" | jq '.'
echo ""

# Step 6: Get suggestions (should include crowd-based suggestions)
echo "6. Getting suggestions..."
curl -s "$API_URL/trip/$TRIP_ID/suggestions" | jq '.'
echo ""

echo "=== Phase 4 Test Complete ==="
echo ""
echo "Expected results:"
echo "- Signals endpoint returns crowds array with 2 places"
echo "- Marina Beach shows 85% busy with peak hours 17:00-19:00"
echo "- Recompute generates crowd-based suggestion (kind: shift)"
echo "- Suggestion explains which places are busy and why they're rescheduled"
