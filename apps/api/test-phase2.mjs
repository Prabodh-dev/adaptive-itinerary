/**
 * Phase 2 Test Script
 * Tests place search and itinerary generation with optimization
 */

const BASE_URL = "http://localhost:8080";

async function testPhase2() {
  console.log("=== Phase 2 Test: Place Search & Route Optimization ===\n");

  try {
    // Test 1: Health check
    console.log("1. Testing health endpoint...");
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    console.log("✓ Health check:", health);
    console.log();

    // Test 2: Place search
    console.log("2. Testing place search...");
    const searchRes = await fetch(`${BASE_URL}/places/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "museums",
        near: { lat: 40.7589, lng: -73.9851 }, // Times Square, NYC
        radiusKm: 5,
        limit: 5,
      }),
    });
    const searchResult = await searchRes.json();
    if (searchResult.places) {
      console.log(`✓ Found ${searchResult.places.length} places`);
      console.log("Places:", searchResult.places.map((p) => p.name).join(", "));
    } else {
      console.log("⚠ Place search failed (API key issue):", searchResult.message || searchResult.error);
      console.log("  Continuing with manual activities...");
    }
    console.log();

    // Test 3: Create a trip
    console.log("3. Creating a trip in New York City...");
    const tripRes = await fetch(`${BASE_URL}/trip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: "New York City",
        date: "2026-03-15",
        startTime: "09:00",
        endTime: "18:00",
        preferences: {
          pace: "medium",
          interests: ["museums", "parks", "landmarks"],
          avoid: ["crowds"],
          budget: "medium",
        },
      }),
    });
    const trip = await tripRes.json();
    const tripId = trip.tripId;
    console.log("✓ Created trip:", tripId);
    console.log();

    // Test 4: Add multiple activities
    console.log("4. Adding 5 activities in NYC...");
    const activitiesRes = await fetch(
      `${BASE_URL}/trip/${tripId}/activities`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: [
            {
              place: {
                provider: "manual",
                providerPlaceId: "met-museum",
                name: "Metropolitan Museum of Art",
                lat: 40.7794,
                lng: -73.9632,
                category: "Museum",
              },
              durationMin: 120,
              locked: false,
            },
            {
              place: {
                provider: "manual",
                providerPlaceId: "central-park",
                name: "Central Park",
                lat: 40.7829,
                lng: -73.9654,
                category: "Park",
              },
              durationMin: 60,
              locked: false,
            },
            {
              place: {
                provider: "manual",
                providerPlaceId: "empire-state",
                name: "Empire State Building",
                lat: 40.7484,
                lng: -73.9857,
                category: "Landmark",
              },
              durationMin: 90,
              locked: true, // Lock this activity to test optimization
            },
            {
              place: {
                provider: "manual",
                providerPlaceId: "times-square",
                name: "Times Square",
                lat: 40.7580,
                lng: -73.9855,
                category: "Landmark",
              },
              durationMin: 45,
              locked: false,
            },
            {
              place: {
                provider: "manual",
                providerPlaceId: "brooklyn-bridge",
                name: "Brooklyn Bridge",
                lat: 40.7061,
                lng: -73.9969,
                category: "Landmark",
              },
              durationMin: 60,
              locked: false,
            },
          ],
        }),
      }
    );
    const activitiesResult = await activitiesRes.json();
    console.log(`✓ Added ${activitiesResult.count} activities`);
    console.log();

    // Test 5: Generate itinerary WITHOUT optimization
    console.log("5. Generating itinerary WITHOUT optimization...");
    const itinerary1Res = await fetch(
      `${BASE_URL}/trip/${tripId}/itinerary/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "driving",
          optimizeOrder: false,
        }),
      }
    );
    const itinerary1 = await itinerary1Res.json();
    console.log("✓ Generated itinerary (version:", itinerary1.version + ")");
    console.log("Total travel time:", itinerary1.itinerary.totalTravelMin, "min");
    console.log("\nSchedule (no optimization):");
    itinerary1.itinerary.items.forEach((item) => {
      console.log(
        `  ${item.startTime}-${item.endTime}: ${item.placeName} (travel: ${item.travelFromPrevMin} min)`
      );
    });
    console.log();

    // Test 6: Generate itinerary WITH optimization
    console.log("6. Generating itinerary WITH optimization...");
    const itinerary2Res = await fetch(
      `${BASE_URL}/trip/${tripId}/itinerary/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "driving",
          optimizeOrder: true,
        }),
      }
    );
    const itinerary2 = await itinerary2Res.json();
    console.log("✓ Generated itinerary (version:", itinerary2.version + ")");
    console.log("Total travel time:", itinerary2.itinerary.totalTravelMin, "min");
    console.log("\nSchedule (with optimization):");
    itinerary2.itinerary.items.forEach((item) => {
      console.log(
        `  ${item.startTime}-${item.endTime}: ${item.placeName} (travel: ${item.travelFromPrevMin} min)`
      );
    });
    console.log();

    // Test 7: Compare results
    console.log("7. Comparison:");
    console.log(
      `  Without optimization: ${itinerary1.itinerary.totalTravelMin} min travel time`
    );
    console.log(
      `  With optimization:    ${itinerary2.itinerary.totalTravelMin} min travel time`
    );
    const savings = itinerary1.itinerary.totalTravelMin - itinerary2.itinerary.totalTravelMin;
    if (savings > 0) {
      console.log(`  ✓ Saved ${savings} minutes through optimization!`);
    } else if (savings < 0) {
      console.log(`  Note: Optimization increased travel by ${Math.abs(savings)} minutes (may be due to locked activities)`);
    } else {
      console.log("  Same travel time (optimization had no effect)");
    }
    console.log();

    // Test 8: Get final trip data
    console.log("8. Retrieving final trip data...");
    const tripDataRes = await fetch(`${BASE_URL}/trip/${tripId}`);
    const tripData = await tripDataRes.json();
    console.log("✓ Trip has", tripData.activities.length, "activities");
    console.log("✓ Latest itinerary version:", tripData.latestItinerary?.version);
    console.log();

    console.log("=== All Phase 2 Tests Completed Successfully! ===");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testPhase2();
