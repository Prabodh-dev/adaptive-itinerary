/**
 * Weather Worker - Polls weather data and updates API
 */
import "dotenv/config";

const API_BASE_URL = process.env.API_URL || "http://localhost:8080";
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const POLL_INTERVAL_SEC = parseInt(
  process.env.WEATHER_POLL_INTERVAL_SEC || "120",
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
 * Main polling loop
 */
async function pollWeather(): Promise<void> {
  console.log("Polling weather data...");

  try {
    // Fetch all trip IDs
    const tripIds = await fetchTripIds();
    console.log(`Found ${tripIds.length} trips`);

    // Process each trip
    for (const tripId of tripIds) {
      await processTrip(tripId);
    }

    console.log("Polling cycle complete");
  } catch (error) {
    console.error("Error during polling cycle:", error);
  }
}

/**
 * Start worker
 */
async function start() {
  console.log("=== Weather Worker ===");
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Poll interval: ${POLL_INTERVAL_SEC}s`);

  if (!OPENWEATHER_API_KEY) {
    console.error("ERROR: OPENWEATHER_API_KEY not set in environment");
    process.exit(1);
  }

  // Initial poll
  await pollWeather();

  // Set up interval
  setInterval(async () => {
    await pollWeather();
  }, POLL_INTERVAL_SEC * 1000);

  console.log("Worker started, polling every", POLL_INTERVAL_SEC, "seconds");
}

start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
