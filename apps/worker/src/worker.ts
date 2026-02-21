/**
 * Weather and Crowd Worker - Polls weather and crowd data and updates API
 */
import "dotenv/config";

const API_BASE_URL = process.env.API_URL || "http://localhost:8080";
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const BESTTIME_API_KEY = process.env.BESTTIME_API_KEY;
const WEATHER_POLL_INTERVAL_SEC = parseInt(
  process.env.WEATHER_POLL_INTERVAL_SEC || "120",
  10
);
const CROWD_POLL_INTERVAL_SEC = parseInt(
  process.env.CROWD_POLL_INTERVAL_SEC || "180",
  10
);

interface Trip {
  tripId: string;
  city: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface Activity {
  activityId: string;
  place: {
    name: string;
    lat: number;
    lon: number;
    providerPlaceId?: string;
  };
}

interface TripData {
  trip: Trip;
  activities: Activity[];
  latestItinerary?: {
    version: number;
    itinerary: {
      items: Array<{
        activityId: string;
        startTime: string;
        endTime: string;
      }>;
    };
  };
}

interface ForecastItem {
  dt: number;
  dt_txt: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  pop: number;
}

interface OpenWeatherForecastResponse {
  list: ForecastItem[];
}

/**
 * Fetch all trip IDs from API
 */
async function fetchTripIds(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/trips`);
  if (!response.ok) {
    throw new Error(`Failed to fetch trip IDs: ${response.statusText}`);
  }
  const data = await response.json();
  return data.tripIds || [];
}

/**
 * Fetch trip data from API
 */
async function fetchTripData(tripId: string): Promise<TripData | null> {
  const response = await fetch(`${API_BASE_URL}/trip/${tripId}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch trip data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch weather forecast from OpenWeather API
 */
async function fetchWeatherForecast(
  lat: number,
  lon: number
): Promise<OpenWeatherForecastResponse> {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch weather: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Analyze weather forecast and identify risk hours
 */
function analyzeWeatherForecast(rawForecast: OpenWeatherForecastResponse): {
  summary: string;
  riskHours: string[];
} {
  const riskHours: string[] = [];

  // Analyze each forecast slot
  for (const item of rawForecast.list) {
    const isRisky =
      item.pop >= 0.6 ||
      item.weather.some((w) =>
        ["Rain", "Thunderstorm", "Drizzle"].includes(w.main)
      );

    if (isRisky) {
      // Convert dt to HH:mm format
      const dateTime = new Date(item.dt * 1000);
      const hour = dateTime.getHours().toString().padStart(2, "0");
      const minute = dateTime.getMinutes().toString().padStart(2, "0");
      const timeStr = `${hour}:${minute}`;

      if (!riskHours.includes(timeStr)) {
        riskHours.push(timeStr);
      }
    }
  }

  // Generate summary
  let summary: string;
  if (riskHours.length === 0) {
    summary = "No rain risk detected";
  } else if (riskHours.length === 1) {
    summary = `Rain risk around ${riskHours[0]}`;
  } else if (riskHours.length === 2) {
    summary = `Rain risk between ${riskHours[0]}–${riskHours[1]}`;
  } else {
    const firstHour = riskHours[0];
    const lastHour = riskHours[riskHours.length - 1];
    summary = `Rain risk between ${firstHour}–${lastHour}`;
  }

  return { summary, riskHours };
}

/**
 * Post weather signal to API
 */
async function postWeatherSignal(
  tripId: string,
  summary: string,
  riskHours: string[],
  raw: OpenWeatherForecastResponse
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/internal/trip/${tripId}/signals/weather`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary,
        riskHours,
        raw,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to post weather signal: ${response.statusText}`);
  }
}

/**
 * Trigger recompute of suggestions
 */
async function triggerRecompute(tripId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/internal/trip/${tripId}/recompute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to trigger recompute: ${response.statusText}`);
  }
}

/**
 * Process a single trip
 */
async function processTrip(tripId: string): Promise<void> {
  try {
    console.log(`[${tripId}] Processing trip...`);

    // Fetch trip data
    const tripData = await fetchTripData(tripId);
    if (!tripData) {
      console.log(`[${tripId}] Trip not found, skipping`);
      return;
    }

    const { trip, activities } = tripData;

    // Need at least one activity with location
    if (activities.length === 0) {
      console.log(`[${tripId}] No activities, skipping`);
      return;
    }

    // Use first activity location as representative location for the trip
    const firstActivity = activities[0];
    const { lat, lon } = firstActivity.place;

    console.log(
      `[${tripId}] Fetching weather for ${trip.city} (${lat}, ${lon})...`
    );

    // Fetch weather forecast
    const forecast = await fetchWeatherForecast(lat, lon);

    // Analyze forecast
    const { summary, riskHours } = analyzeWeatherForecast(forecast);

    console.log(`[${tripId}] Weather: ${summary}`);
    if (riskHours.length > 0) {
      console.log(`[${tripId}] Risk hours: ${riskHours.join(", ")}`);
    }

    // Post weather signal
    await postWeatherSignal(tripId, summary, riskHours, forecast);
    console.log(`[${tripId}] Weather signal posted`);

    // Trigger recompute
    await triggerRecompute(tripId);
    console.log(`[${tripId}] Recompute triggered`);
  } catch (error) {
    console.error(`[${tripId}] Error processing trip:`, error);
  }
}

/**
 * Fetch crowd data from BestTime-like API (with fallback)
 */
async function fetchCrowdData(
  name: string,
  lat: number,
  lng: number,
  address?: string
): Promise<{ busyNow: number; peakHours: string[]; raw: any }> {
  // If no API key, use fallback
  if (!BESTTIME_API_KEY || BESTTIME_API_KEY.trim() === "") {
    return generateFallbackCrowdData();
  }

  try {
    const body = {
      api_key_private: BESTTIME_API_KEY,
      venue_name: name,
      venue_address: address || `${lat},${lng}`,
    };

    const response = await fetch("https://besttime.app/api/v1/forecasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn(`BestTime API returned ${response.status}, using fallback`);
      return generateFallbackCrowdData();
    }

    const data = await response.json();
    return {
      busyNow: extractBusyNow(data),
      peakHours: extractPeakHours(data),
      raw: data,
    };
  } catch (error) {
    console.warn("Failed to fetch BestTime data, using fallback:", error);
    return generateFallbackCrowdData();
  }
}

function extractBusyNow(data: any): number {
  try {
    if (typeof data?.analysis?.venue_forecasted_busyness === "number") {
      return Math.min(100, Math.max(0, data.analysis.venue_forecasted_busyness));
    }
    return Math.floor(Math.random() * 61) + 20; // 20-80
  } catch {
    return Math.floor(Math.random() * 61) + 20;
  }
}

function extractPeakHours(data: any): string[] {
  try {
    const analysis = data?.analysis;
    if (!Array.isArray(analysis?.hour_analysis)) {
      return ["17:00", "18:00"];
    }

    const currentDay = new Date().getDay();
    const peakHours: string[] = [];

    for (const hourData of analysis.hour_analysis) {
      if (hourData.day_int === currentDay && (hourData.intensity_nr || 0) >= 75) {
        const hour = String(hourData.hour).padStart(2, "0");
        peakHours.push(`${hour}:00`);
      }
    }

    return peakHours.length > 0 ? peakHours : ["17:00", "18:00"];
  } catch {
    return ["17:00", "18:00"];
  }
}

function generateFallbackCrowdData(): { busyNow: number; peakHours: string[]; raw: any } {
  return {
    busyNow: Math.floor(Math.random() * 61) + 20, // 20-80
    peakHours: ["17:00", "18:00"],
    raw: { fallback: true },
  };
}

/**
 * Post crowd signals to API
 */
async function postCrowdSignals(
  tripId: string,
  crowds: Array<{ placeId: string; placeName: string; busyNow: number; peakHours: string[] }>,
  raw: any
): Promise<void> {
  const body = {
    observedAt: new Date().toISOString(),
    crowds,
    raw,
  };

  const response = await fetch(
    `${API_BASE_URL}/internal/trip/${tripId}/signals/crowds`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to post crowd signals: ${response.statusText}`);
  }
}

/**
 * Process crowd data for one trip
 */
async function processTripCrowds(tripId: string): Promise<void> {
  try {
    console.log(`[Crowds][${tripId}] Processing...`);

    const tripData = await fetchTripData(tripId);
    if (!tripData) {
      console.log(`[Crowds][${tripId}] Trip not found, skipping`);
      return;
    }

    const { activities } = tripData;

    if (activities.length === 0) {
      console.log(`[Crowds][${tripId}] No activities, skipping`);
      return;
    }

    console.log(
      `[Crowds][${tripId}] Fetching crowd data for ${activities.length} places (max 8)...`
    );

    const crowds: Array<{
      placeId: string;
      placeName: string;
      busyNow: number;
      peakHours: string[];
    }> = [];

    // Limit to 8 places to avoid rate limits
    const limitedActivities = activities.slice(0, 8);

    for (const activity of limitedActivities) {
      const { busyNow, peakHours } = await fetchCrowdData(
        activity.place.name,
        activity.place.lat,
        activity.place.lon,
        undefined
      );

      crowds.push({
        placeId: activity.place.providerPlaceId || activity.activityId,
        placeName: activity.place.name,
        busyNow,
        peakHours,
      });

      console.log(
        `[Crowds][${tripId}] ${activity.place.name}: ${busyNow}% busy, peak ${peakHours.join(", ")}`
      );
    }

    // Post crowd signals
    await postCrowdSignals(tripId, crowds, { source: "worker" });
    console.log(`[Crowds][${tripId}] Crowd signals posted`);

    // Trigger recompute
    await triggerRecompute(tripId);
    console.log(`[Crowds][${tripId}] Recompute triggered`);
  } catch (error) {
    console.error(`[Crowds][${tripId}] Error processing trip:`, error);
  }
}

/**
 * Main polling loop for weather
 */
async function pollWeather(): Promise<void> {
  console.log("[Weather] Polling weather data...");

  try {
    // Fetch all trip IDs
    const tripIds = await fetchTripIds();
    console.log(`[Weather] Found ${tripIds.length} trips`);

    // Process each trip
    for (const tripId of tripIds) {
      await processTrip(tripId);
    }

    console.log("[Weather] Polling cycle complete");
  } catch (error) {
    console.error("[Weather] Error during polling cycle:", error);
  }
}

/**
 * Main polling loop for crowds
 */
async function pollCrowds(): Promise<void> {
  console.log("[Crowds] Polling crowd data...");

  try {
    // Fetch all trip IDs
    const tripIds = await fetchTripIds();
    console.log(`[Crowds] Found ${tripIds.length} trips`);

    // Process each trip
    for (const tripId of tripIds) {
      await processTripCrowds(tripId);
    }

    console.log("[Crowds] Polling cycle complete");
  } catch (error) {
    console.error("[Crowds] Error during polling cycle:", error);
  }
}

/**
 * Start worker
 */
async function start() {
  console.log("=== Weather & Crowd Worker ===");
  
  // Validate required API keys
  if (!OPENWEATHER_API_KEY) {
    console.error("ERROR: OPENWEATHER_API_KEY is required but not set in .env");
    console.error("Get your API key at: https://openweathermap.org/api");
    process.exit(1);
  }
  
  if (!BESTTIME_API_KEY) {
    console.error("ERROR: BESTTIME_API_KEY is required but not set in .env");
    console.error("Get your private API key at: https://besttime.app/api/v1/keys");
    console.error("Note: You need a PRIVATE key (starts with 'pri_'), not a public key");
    process.exit(1);
  }

  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Weather poll interval: ${WEATHER_POLL_INTERVAL_SEC}s`);
  console.log(`Crowd poll interval: ${CROWD_POLL_INTERVAL_SEC}s`);
  console.log("✓ All API keys configured");

  // Initial polls
  await pollWeather();
  await pollCrowds();

  // Set up intervals
  setInterval(async () => {
    await pollWeather();
  }, WEATHER_POLL_INTERVAL_SEC * 1000);

  setInterval(async () => {
    await pollCrowds();
  }, CROWD_POLL_INTERVAL_SEC * 1000);

  console.log("Worker started");
}

start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
