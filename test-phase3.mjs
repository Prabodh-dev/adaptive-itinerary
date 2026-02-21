#!/usr/bin/env node

/**
 * Phase 3 Integration Test Script
 * Tests weather signals, suggestions, and SSE endpoints
 */

const API_BASE = "http://localhost:8080";

// Test utilities
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json();
}

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function success(message) {
  log("✅", message);
}

function info(message) {
  log("ℹ️ ", message);
}

function error(message) {
  log("❌", message);
}

// Test steps
async function testHealthCheck() {
  info("Testing health check endpoint...");
  const response = await request("/health");
  if (response.status === "ok") {
    success("Health check passed");
    return true;
  }
  error("Health check failed");
  return false;
}

async function createTestTrip() {
  info("Creating test trip...");
  const tripData = {
    city: "San Francisco",
    date: "2026-02-22",
    startTime: "09:00",
    endTime: "18:00",
    preferences: {
      pace: "moderate",
      budget: "medium",
      interests: ["culture", "food"],
    },
  };

  const response = await request("/trip", {
    method: "POST",
    body: JSON.stringify(tripData),
  });

  success(`Trip created: ${response.tripId}`);
  return response.tripId;
}

async function addTestActivities(tripId) {
  info("Adding test activities...");
  const activities = [
    {
      place: {
        provider: "foursquare",
        providerPlaceId: "test_1",
        name: "Golden Gate Park",
        lat: 37.7694,
        lng: -122.4862,
        category: "Park",
        isIndoor: false,
      },
      durationMin: 90,
      locked: false,
    },
    {
      place: {
        provider: "foursquare",
        providerPlaceId: "test_2",
        name: "Ferry Building Marketplace",
        lat: 37.7956,
        lng: -122.3933,
        category: "Market",
        isIndoor: true,
      },
      durationMin: 60,
      locked: false,
    },
    {
      place: {
        provider: "foursquare",
        providerPlaceId: "test_3",
        name: "Alcatraz Island",
        lat: 37.8267,
        lng: -122.423,
        category: "Historic Site",
        isIndoor: false,
      },
      durationMin: 120,
      locked: false,
    },
  ];

  await request(`/trip/${tripId}/activities`, {
    method: "POST",
    body: JSON.stringify({ activities }),
  });

  success(`Added ${activities.length} activities`);
}

async function generateTestItinerary(tripId) {
  info("Generating itinerary...");
  const response = await request(`/trip/${tripId}/itinerary/generate`, {
    method: "POST",
    body: JSON.stringify({ mode: "driving" }),
  });

  success(`Itinerary generated (version ${response.version})`);
  info(`  Total travel time: ${response.itinerary.totalTravelMin} minutes`);
  info(`  Number of items: ${response.itinerary.items.length}`);

  return response.itinerary;
}

async function testGetTrips() {
  info("Testing GET /trips endpoint...");
  const response = await request("/trips");
  success(`Found ${response.tripIds.length} trip(s)`);
  return response.tripIds;
}

async function testWeatherSignal(tripId) {
  info("Testing GET /trip/:tripId/signals endpoint...");
  const response = await request(`/trip/${tripId}/signals`);

  if (response.weather) {
    success(`Weather signal retrieved: ${response.weather.summary}`);
    if (response.weather.riskHours.length > 0) {
      info(`  Risk hours: ${response.weather.riskHours.join(", ")}`);
    }
  } else {
    info("  No weather data yet (expected for new trip)");
  }

  return response;
}

async function testPostWeatherSignal(tripId) {
  info("Testing POST /internal/trip/:tripId/signals/weather endpoint...");

  // Mock weather data with rain risk
  const weatherSignal = {
    summary: "Rain risk between 14:00–17:00",
    riskHours: ["14:00", "15:00", "16:00", "17:00"],
    raw: {
      list: [
        {
          dt: Math.floor(Date.now() / 1000),
          dt_txt: "2026-02-22 14:00:00",
          main: { temp: 15, feels_like: 14, humidity: 80 },
          weather: [{ main: "Rain", description: "light rain" }],
          pop: 0.8,
        },
      ],
    },
  };

  await request(`/internal/trip/${tripId}/signals/weather`, {
    method: "POST",
    body: JSON.stringify(weatherSignal),
  });

  success("Weather signal posted successfully");

  // Verify it was stored
  const signals = await request(`/trip/${tripId}/signals`);
  if (signals.weather.summary === weatherSignal.summary) {
    success("Weather signal verified");
  } else {
    error("Weather signal mismatch");
  }
}

async function testGetSuggestions(tripId) {
  info("Testing GET /trip/:tripId/suggestions endpoint...");
  const response = await request(`/trip/${tripId}/suggestions`);

  success(`Found ${response.suggestions.length} suggestion(s)`);

  response.suggestions.forEach((suggestion, index) => {
    info(`  Suggestion ${index + 1}: ${suggestion.kind}`);
    suggestion.reasons.forEach((reason) => {
      info(`    - ${reason}`);
    });
  });

  return response.suggestions;
}

async function testRecompute(tripId) {
  info("Testing POST /internal/trip/:tripId/recompute endpoint...");
  const response = await request(`/internal/trip/${tripId}/recompute`, {
    method: "POST",
  });

  if (response.suggestion) {
    success(`Suggestion generated: ${response.suggestion.kind}`);
    info(`  Reasons:`);
    response.suggestion.reasons.forEach((reason) => {
      info(`    - ${reason}`);
    });
  } else {
    info("  No suggestion generated (expected if no conflicts)");
  }

  return response;
}

async function testSSEStream(tripId) {
  info("Testing SSE stream endpoint (will connect for 5 seconds)...");

  return new Promise((resolve) => {
    const eventSource = new EventSource(`${API_BASE}/trip/${tripId}/stream`);
    let messageCount = 0;

    eventSource.onopen = () => {
      success("SSE connection established");
    };

    eventSource.addEventListener("ping", (event) => {
      messageCount++;
      const data = JSON.parse(event.data);
      info(`  Received ping: ${data.message}`);
    });

    eventSource.addEventListener("signal:update", (event) => {
      messageCount++;
      const data = JSON.parse(event.data);
      info(`  Received signal:update: ${data.summary}`);
    });

    eventSource.addEventListener("suggestion:new", (event) => {
      messageCount++;
      const data = JSON.parse(event.data);
      info(`  Received suggestion:new: ${data.kind}`);
    });

    eventSource.onerror = (err) => {
      error(`SSE error: ${err.message || "Connection error"}`);
      eventSource.close();
      resolve(false);
    };

    // Wait 5 seconds then close
    setTimeout(() => {
      eventSource.close();
      success(`SSE test completed (received ${messageCount} message(s))`);
      resolve(true);
    }, 5000);
  });
}

// Main test flow
async function runTests() {
  console.log("\n🧪 Phase 3 Integration Tests\n");
  console.log("=".repeat(50));
  console.log();

  try {
    // Test 1: Health check
    await testHealthCheck();
    console.log();

    // Test 2: Create trip and add activities
    const tripId = await createTestTrip();
    console.log();

    await addTestActivities(tripId);
    console.log();

    // Test 3: Generate itinerary
    await generateTestItinerary(tripId);
    console.log();

    // Test 4: Test GET /trips
    await testGetTrips();
    console.log();

    // Test 5: Test weather signals (should be empty)
    await testWeatherSignal(tripId);
    console.log();

    // Test 6: Post weather signal
    await testPostWeatherSignal(tripId);
    console.log();

    // Test 7: Test recompute to generate suggestions
    await testRecompute(tripId);
    console.log();

    // Test 8: Get suggestions
    await testGetSuggestions(tripId);
    console.log();

    // Test 9: Test SSE stream
    await testSSEStream(tripId);
    console.log();

    console.log("=".repeat(50));
    console.log();
    success("All tests completed successfully!");
    console.log();
    info(`Test trip ID: ${tripId}`);
    info("You can view this trip in the web UI at:");
    info(`  http://localhost:3000/trip/${tripId}`);
    console.log();
  } catch (err) {
    console.log();
    console.log("=".repeat(50));
    console.log();
    error(`Test failed: ${err.message}`);
    console.log();
    process.exit(1);
  }
}

// Run tests
runTests();
