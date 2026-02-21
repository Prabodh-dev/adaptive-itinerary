/**
 * Simple test script for the API
 */

const API_URL = "http://localhost:8080";

async function testAPI() {
  try {
    console.log("=================================");
    console.log("Testing Adaptive Itinerary API v1");
    console.log("=================================\n");

    // Test 0: Health check
    console.log("0. Testing GET /health");
    console.log("-----------------------------------");
    const healthResponse = await fetch(`${API_URL}/health`);
    const healthData = await healthResponse.json();
    console.log("Response:", JSON.stringify(healthData, null, 2));
    console.log("Status:", healthResponse.status);
    console.log();

    // Test 1: Create Trip
    console.log("1. Testing POST /trip");
    console.log("-----------------------------------");
    const createTripResponse = await fetch(`${API_URL}/trip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: "Bengaluru",
        date: "2026-02-21",
        startTime: "09:00",
        endTime: "19:00",
        preferences: {
          pace: "medium",
          interests: ["food"],
          avoid: [],
          budget: "medium",
        },
      }),
    });

    const createTripData = await createTripResponse.json();
    console.log("Response:", JSON.stringify(createTripData, null, 2));
    console.log("Status:", createTripResponse.status);
    console.log();

    const tripId = createTripData.tripId;
    if (!tripId) {
      console.error("ERROR: Failed to create trip");
      process.exit(1);
    }

    // Test 2: Add Activities
    console.log(`2. Testing POST /trip/${tripId}/activities`);
    console.log("-----------------------------------");
    const addActivitiesResponse = await fetch(
      `${API_URL}/trip/${tripId}/activities`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: [
            {
              place: {
                provider: "mock",
                providerPlaceId: "p1",
                name: "City Museum",
                lat: 12.9716,
                lng: 77.5946,
                category: "museum",
                isIndoor: true,
              },
              durationMin: 90,
              locked: false,
            },
            {
              place: {
                provider: "mock",
                providerPlaceId: "p2",
                name: "Central Park",
                lat: 12.975,
                lng: 77.6,
                category: "park",
                isIndoor: false,
              },
              durationMin: 60,
              locked: true,
            },
          ],
        }),
      }
    );

    const addActivitiesData = await addActivitiesResponse.json();
    console.log("Response:", JSON.stringify(addActivitiesData, null, 2));
    console.log("Status:", addActivitiesResponse.status);
    console.log();

    // Test 3: Generate Itinerary
    console.log(`3. Testing POST /trip/${tripId}/itinerary/generate`);
    console.log("-----------------------------------");
    const generateItineraryResponse = await fetch(
      `${API_URL}/trip/${tripId}/itinerary/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "driving",
          startLocation: {
            lat: 12.97,
            lng: 77.59,
          },
        }),
      }
    );

    const generateItineraryData = await generateItineraryResponse.json();
    console.log("Response:", JSON.stringify(generateItineraryData, null, 2));
    console.log("Status:", generateItineraryResponse.status);
    console.log();

    // Test 4: Get Trip
    console.log(`4. Testing GET /trip/${tripId}`);
    console.log("-----------------------------------");
    const getTripResponse = await fetch(`${API_URL}/trip/${tripId}`);
    const getTripData = await getTripResponse.json();
    console.log("Response:", JSON.stringify(getTripData, null, 2));
    console.log("Status:", getTripResponse.status);
    console.log();

    console.log("=================================");
    console.log("All tests completed successfully!");
    console.log("=================================");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

testAPI();
