#!/bin/bash

# Check Activity Details
# Usage: bash check-activities.sh <TRIP_ID>

TRIP_ID=$1
API_BASE="http://localhost:8080"

if [ -z "$TRIP_ID" ]; then
  echo "❌ Usage: bash check-activities.sh <TRIP_ID>"
  exit 1
fi

echo "📋 Activity Details for Trip: $TRIP_ID"
echo "=================================================="
echo ""

TRIP_DATA=$(curl -s "$API_BASE/trip/$TRIP_ID")

echo "$TRIP_DATA" | jq -r '.activities[] | "
🏢 \(.place.name)
   Category: \(.place.category // "N/A")
   Indoor: \(.place.isIndoor // "not specified")
   Duration: \(.durationMin) min
   Locked: \(.locked)
   Location: \(.place.lat), \(.place.lng)
"' 2>/dev/null || {
  echo "⚠️  jq not installed, showing raw JSON:"
  echo "$TRIP_DATA"
}

echo ""
echo "=================================================="
echo ""
echo "💡 Tips:"
echo "- If 'Indoor: false' → Outdoor activity (affected by rain)"
echo "- If 'Indoor: true' → Indoor activity (not affected by rain)"
echo "- If 'Indoor: not specified' → Assumed to be outdoor"
echo ""
