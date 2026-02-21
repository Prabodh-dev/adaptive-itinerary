/**
 * Weather, Crowd, and Transit Worker - Polls real-time data and updates API
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load .env from project root (2 levels up from this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

import { 
  besttimeNewForecast, 
  besttimeLive,
  transitlandFindStopsNear,
  transitlandGetDepartures,
  extractTransitAlertsFromDepartures
} from "@adaptive/integrations";

const API_BASE_URL = process.env.API_URL || "http://localhost:8080";
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const BESTTIME_API_KEY_PRIVATE = process.env.BESTTIME_API_KEY_PRIVATE;
const WEATHER_POLL_INTERVAL_SEC = parseInt(
  process.env.WEATHER_POLL_INTERVAL_SEC || "120",
  10
);
const CROWD_POLL_INTERVAL_SEC = parseInt(
  process.env.CROWD_POLL_INTERVAL_SEC || "300",
  10
);
const MAX_CROWD_VENUES_PER_TRIP = parseInt(
  process.env.MAX_CROWD_VENUES_PER_TRIP || "8",
  10
);
const TRANSITLAND_API_KEY = process.env.TRANSITLAND_API_KEY || "";
const TRANSITLAND_BASE_URL = process.env.TRANSITLAND_BASE_URL || "https://transit.land/api/v2/rest";
const TRANSIT_POLL_INTERVAL_SEC = parseInt(
  process.env.TRANSIT_POLL_INTERVAL_SEC || "180",
  10
);
const TRANSIT_DELAY_THRESHOLD_MIN = parseInt(
  process.env.TRANSIT_DELAY_THRESHOLD_MIN || "10",
  10
);
const TRANSIT_STOPS_RADIUS_M = parseInt(
  process.env.TRANSIT_STOPS_RADIUS_M || "800",
  10
);
const TRANSIT_MAX_STOPS = parseInt(
  process.env.TRANSIT_MAX_STOPS || "3",
  10
);
const TRANSIT_NEXT_SECONDS = parseInt(
  process.env.TRANSIT_NEXT_SECONDS || "3600",
  10
);

// ============================================================================
// Types
// ============================================================================

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
    lng: number;  // Changed from 'lon' to 'lng' to match API response
    providerPlaceId?: string;
    category?: string;
    isIndoor?: boolean;
    address?: string;
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

// ============================================================================
// Venue ID Cache (in-memory)
// Maps placeId -> { venueId: string, peakHours: string[] }
// ============================================================================

const venueCache = new Map<string, { venueId: string; peakHours: string[] }>();

// ============================================================================
// Weather Helpers
// ============================================================================

async function fetchTripIds(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/trips`);
  if (!response.ok) {
    throw new Error(`Failed to fetch trips: ${response.statusText}`);
  }
  const data = await response.json();
  return data.tripIds || [];
}

async function fetchTripData(tripId: string): Promise<TripData> {
  const response = await fetch(`${API_BASE_URL}/trip/${tripId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch trip ${tripId}: ${response.statusText}`);
  }
  return await response.json();
}

function getDateAtMidnight(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

async function fetchWeatherForecast(
  lat: number,
  lon: number
): Promise<ForecastItem[]> {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Weather API error: ${response.status} ${response.statusText}`
    );
  }
  const data: OpenWeatherForecastResponse = await response.json();
  return data.list;
}

async function fetchLatLngForCity(
  city: string
): Promise<{ lat: number; lon: number }> {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
    city
  )}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocode API error: ${response.status}`);
  }
  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error(`City not found: ${city}`);
  }
  return { lat: data[0].lat, lon: data[0].lon };
}

async function postWeatherSignal(
  tripId: string,
  summary: string,
  riskHours: string[],
  raw: any
): Promise<void> {
  const payload = {
    observedAt: new Date().toISOString(),
    weather: { summary, riskHours },
    raw,
  };

  const response = await fetch(
    `${API_BASE_URL}/internal/trip/${tripId}/signals/weather`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to post weather signal: ${response.status} ${response.statusText}`
    );
  }
}

async function triggerRecompute(tripId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/internal/trip/${tripId}/recompute`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to trigger recompute: ${response.status} ${response.statusText}`
    );
  }
}

async function processTripWeather(tripId: string): Promise<void> {
  try {
    const tripData = await fetchTripData(tripId);
    const { trip } = tripData;

    const tripDate = getDateAtMidnight(trip.date);
    const now = new Date();
    const hoursDiff = (tripDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 0 || hoursDiff > 120) {
      console.log(
        `[${tripId}] Trip date out of forecast window (${Math.round(hoursDiff)}h), skipping`
      );
      return;
    }

    const { lat, lon } = await fetchLatLngForCity(trip.city);
    const forecast = await fetchWeatherForecast(lat, lon);

    const tripStart = new Date(`${trip.date}T${trip.startTime}:00Z`);
    const tripEnd = new Date(`${trip.date}T${trip.endTime}:00Z`);

    const forecastDuring = forecast.filter((item) => {
      const dt = new Date(item.dt * 1000);
      return dt >= tripStart && dt <= tripEnd;
    });

    const riskHours: string[] = [];
    const hasBadWeather = forecastDuring.some((item) => {
      const isRain =
        item.weather.some((w) =>
          ["Rain", "Drizzle", "Thunderstorm"].includes(w.main)
        ) && item.pop >= 0.3;
      const isHeavyRain = item.pop >= 0.7;

      if (isRain || isHeavyRain) {
        const dt = new Date(item.dt * 1000);
        const hh = String(dt.getUTCHours()).padStart(2, "0");
        const mm = String(dt.getUTCMinutes()).padStart(2, "0");
        riskHours.push(`${hh}:${mm}`);
        return true;
      }
      return false;
    });

    const summary = hasBadWeather
      ? `Rain likely on ${trip.date}`
      : `Clear skies expected`;

    await postWeatherSignal(tripId, summary, riskHours, {
      city: trip.city,
      date: trip.date,
      forecastCount: forecastDuring.length,
    });

    console.log(`[${tripId}] Weather signal updated: ${summary}`);

    await triggerRecompute(tripId);
    console.log(`[${tripId}] Recompute triggered`);
  } catch (error) {
    console.error(`[${tripId}] Error processing trip:`, error);
  }
}

async function pollWeather(): Promise<void> {
  console.log("[Weather] Polling weather data...");

  try {
    const tripIds = await fetchTripIds();
    console.log(`[Weather] Found ${tripIds.length} trips`);

    if (tripIds.length === 0) {
      console.log("[Weather] No trips to process");
      return;
    }

    for (const tripId of tripIds) {
      await processTripWeather(tripId);
    }

    console.log("[Weather] Polling cycle complete");
  } catch (error) {
    console.error("[Weather] Error during polling cycle:", error);
  }
}

// ============================================================================
// Crowd Helpers (BestTime Real API)
// ============================================================================

/**
 * Get day_int from date string (Mon=0..Sun=6)
 */
function getDayInt(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // BestTime uses Mon=0, ..., Sun=6
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
}

/**
 * Extract peak hours from BestTime forecast analysis for specific day
 */
function extractPeakHours(analysis: any, dayInt: number): string[] {
  if (!analysis || !Array.isArray(analysis.day_info)) {
    return [];
  }

  const dayInfo = analysis.day_info.find((d: any) => d.day_int === dayInt);
  if (!dayInfo || !Array.isArray(dayInfo.busy_hours)) {
    return [];
  }

  // busy_hours is array of integers (0-23)
  return dayInfo.busy_hours.map((h: number) => {
    const hourStr = String(h).padStart(2, "0");
    return `${hourStr}:00`;
  });
}

/**
 * Ensure venue is cached with venue_id and peak hours
 * Returns cached data or null if forecast failed
 */
async function ensureVenueCached(
  placeId: string,
  name: string,
  address: string,
  tripDate: string
): Promise<{ venueId: string; peakHours: string[] } | null> {
  // Check cache first
  if (venueCache.has(placeId)) {
    return venueCache.get(placeId)!;
  }

  // Call new forecast to get venue_id
  console.log(`[Crowds] Fetching forecast for ${name}...`);
  const forecast = await besttimeNewForecast({
    apiKeyPrivate: BESTTIME_API_KEY_PRIVATE!,
    venueName: name,
    venueAddress: address,
  });

  if (!forecast.venueId) {
    console.warn(`[Crowds] No venue_id returned for ${name}`);
    return null;
  }

  // Extract peak hours for trip date
  const dayInt = getDayInt(tripDate);
  const peakHours = extractPeakHours(forecast.analysis, dayInt);

  const cacheData = {
    venueId: forecast.venueId,
    peakHours,
  };

  venueCache.set(placeId, cacheData);
  console.log(
    `[Crowds] Cached venue ${name}: venueId=${forecast.venueId}, peaks=${peakHours.join(",")}`
  );

  return cacheData;
}

/**
 * Post crowd signals to API
 */
async function postCrowdSignals(
  tripId: string,
  crowds: Array<{
    placeId: string;
    placeName: string;
    busyNow: number;
    peakHours: string[];
  }>,
  raw: any
): Promise<void> {
  const payload = {
    observedAt: new Date().toISOString(),
    crowds,
    raw,
  };

  const response = await fetch(
    `${API_BASE_URL}/internal/trip/${tripId}/signals/crowds`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to post crowd signals: ${response.status} ${response.statusText}`
    );
  }
}

/**
 * Process crowd data for a single trip
 */
async function processTripCrowd(tripId: string): Promise<void> {
  try {
    console.log(`[Crowds][${tripId}] Processing trip...`);

    const tripData = await fetchTripData(tripId);
    const { trip, activities } = tripData;

    if (activities.length === 0) {
      console.log(`[Crowds][${tripId}] No activities, skipping`);
      return;
    }

    console.log(
      `[Crowds][${tripId}] Fetching crowd data for ${activities.length} places (max ${MAX_CROWD_VENUES_PER_TRIP})...`
    );

    const crowds: Array<{
      placeId: string;
      placeName: string;
      busyNow: number;
      peakHours: string[];
    }> = [];

    // Limit to max venues
    const limitedActivities = activities.slice(0, MAX_CROWD_VENUES_PER_TRIP);

    for (const activity of limitedActivities) {
      const { place } = activity;
      const placeId = place.providerPlaceId || activity.activityId;
      const name = place.name;
      const address = place.address || trip.city;

      // Ensure venue is cached
      const cached = await ensureVenueCached(placeId, name, address, trip.date);
      if (!cached) {
        console.warn(`[Crowds][${tripId}] Skipping ${name} (forecast failed)`);
        continue;
      }

      // Rate limiting: 200ms between requests (5 req/sec)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Fetch live data
      console.log(`[Crowds][${tripId}] Fetching live data for ${name}...`);
      const live = await besttimeLive({
        apiKeyPrivate: BESTTIME_API_KEY_PRIVATE!,
        venueId: cached.venueId,
      });

      // Determine busyNow: prefer live, fallback to forecasted
      const busyNow = live.liveBusyness ?? live.forecastedBusyness;

      if (busyNow === null) {
        console.warn(`[Crowds][${tripId}] No busyness data for ${name}`);
        continue;
      }

      crowds.push({
        placeId,
        placeName: name,
        busyNow,
        peakHours: cached.peakHours,
      });

      const liveLabel = live.liveAvailable ? "live" : "forecasted";
      console.log(
        `[Crowds][${tripId}] ${name}: ${busyNow}% (${liveLabel}), peak ${cached.peakHours.join(", ")}`
      );
    }

    if (crowds.length === 0) {
      console.log(`[Crowds][${tripId}] No crowd data collected`);
      return;
    }

    // Post crowd signals
    await postCrowdSignals(tripId, crowds, { source: "worker-besttime" });
    console.log(`[Crowds][${tripId}] Crowd signals posted (${crowds.length} places)`);

    // Trigger recompute
    await triggerRecompute(tripId);
    console.log(`[Crowds][${tripId}] Recompute triggered`);
  } catch (error) {
    console.error(`[Crowds][${tripId}] Error processing trip:`, error);
  }
}

/**
 * Poll crowd data for all trips
 */
async function pollCrowds(): Promise<void> {
  console.log("[Crowds] Polling crowd data...");

  try {
    const tripIds = await fetchTripIds();
    console.log(`[Crowds] Found ${tripIds.length} trips`);

    if (tripIds.length === 0) {
      console.log("[Crowds] No trips to process");
      return;
    }

    for (const tripId of tripIds) {
      await processTripCrowd(tripId);
    }

    console.log("[Crowds] Polling cycle complete");
  } catch (error) {
    console.error("[Crowds] Error during polling cycle:", error);
  }
}

// ============================================================================
// Transit Polling Loop (Transitland)
// ============================================================================

/**
 * Poll Transitland for transit delays and alerts
 */
async function pollTransit(): Promise<void> {
  console.log("[Transit] Polling transit data via Transitland...");

  if (!TRANSITLAND_API_KEY) {
    console.warn("[Transit] TRANSITLAND_API_KEY not set, skipping transit polling");
    return;
  }

  try {
    const tripIds = await fetchTripIds();
    console.log(`[Transit] Found ${tripIds.length} trips`);

    if (tripIds.length === 0) {
      console.log("[Transit] No trips to process");
      return;
    }

    // Process each trip
    for (const tripId of tripIds) {
      try {
        // Get trip data to determine location
        const tripData = await fetchTripData(tripId);
        if (!tripData || !tripData.trip) {
          console.warn(`[Transit][${tripId}] Failed to fetch trip data`);
          continue;
        }

        // Determine reference coordinates for transit stop search
        let refLat: number | null = null;
        let refLon: number | null = null;

        // Option 1: Use startLocation if stored (would need to add this to trip schema)
        // For now, use first activity location as reference
        if (tripData.activities && tripData.activities.length > 0) {
          const firstActivity = tripData.activities[0];
          refLat = firstActivity.place.lat;
          refLon = firstActivity.place.lng;  // Changed from 'lon' to 'lng'
        }

        if (refLat === null || refLon === null) {
          console.warn(`[Transit][${tripId}] No location available for transit search`);
          continue;
        }

        console.log(
          `[Transit][${tripId}] Searching for stops near ${refLat.toFixed(4)}, ${refLon.toFixed(4)}`
        );

        // Find nearby transit stops
        const stops = await transitlandFindStopsNear({
          lat: refLat,
          lon: refLon,
          radiusM: TRANSIT_STOPS_RADIUS_M,
          limit: TRANSIT_MAX_STOPS,
          apiKey: TRANSITLAND_API_KEY,
          baseUrl: TRANSITLAND_BASE_URL,
        });

        if (stops.length === 0) {
          console.log(`[Transit][${tripId}] No transit stops found nearby`);
          // Post empty alerts
          await postTransitSignals(tripId, []);
          continue;
        }

        console.log(`[Transit][${tripId}] Found ${stops.length} nearby stops`);

        // Collect alerts from all nearby stops
        const allAlerts: Array<{ line: string; delayMin: number; message: string }> = [];

        for (const stop of stops) {
          try {
            console.log(`[Transit][${tripId}] Fetching departures for stop: ${stop.stop_name}`);
            
            const departuresResponse = await transitlandGetDepartures({
              stopKey: stop.stop_key,
              nextSeconds: TRANSIT_NEXT_SECONDS,
              includeAlerts: true,
              apiKey: TRANSITLAND_API_KEY,
              baseUrl: TRANSITLAND_BASE_URL,
            });

            const alerts = extractTransitAlertsFromDepartures(departuresResponse);
            allAlerts.push(...alerts);

            console.log(`[Transit][${tripId}] Extracted ${alerts.length} alerts from ${stop.stop_name}`);
          } catch (error) {
            console.error(`[Transit][${tripId}] Error fetching departures for stop ${stop.stop_key}:`, error);
          }
        }

        // Merge and deduplicate alerts by line
        const alertsByLine = new Map<string, { line: string; delayMin: number; message: string }>();
        for (const alert of allAlerts) {
          const existing = alertsByLine.get(alert.line);
          if (!existing || alert.delayMin > existing.delayMin) {
            alertsByLine.set(alert.line, alert);
          }
        }

        // Sort by delay and keep top 5
        const finalAlerts = Array.from(alertsByLine.values())
          .sort((a, b) => b.delayMin - a.delayMin)
          .slice(0, 5);

        console.log(`[Transit][${tripId}] Final: ${finalAlerts.length} unique alerts`);

        // Post transit signals
        await postTransitSignals(tripId, finalAlerts);

        // Trigger recompute
        const recomputeResp = await fetch(
          `${API_BASE_URL}/internal/trip/${tripId}/recompute`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        if (recomputeResp.ok) {
          console.log(`[Transit][${tripId}] Recompute triggered`);
        }
      } catch (error) {
        console.error(`[Transit][${tripId}] Error processing trip:`, error);
      }
    }

    console.log("[Transit] Polling cycle complete");
  } catch (error) {
    console.error("[Transit] Error during polling cycle:", error);
  }
}

/**
 * Post transit signals to API
 */
async function postTransitSignals(
  tripId: string,
  alerts: Array<{ line: string; delayMin: number; message: string }>
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/internal/trip/${tripId}/signals/transit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observedAt: new Date().toISOString(),
          transit: {
            alerts,
          },
          raw: {
            source: "transitland",
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(
        `[Transit][${tripId}] Failed to post transit signals: ${response.status}`
      );
      return;
    }

    console.log(`[Transit][${tripId}] Posted ${alerts.length} transit alerts`);
  } catch (error) {
    console.error(`[Transit][${tripId}] Error posting signals:`, error);
  }
}

// ============================================================================
// Worker Startup
// ============================================================================

async function start() {
  console.log("=== Weather, Crowd & Transit Worker ===");

  // Validate required API keys
  if (!OPENWEATHER_API_KEY) {
    console.error("ERROR: OPENWEATHER_API_KEY is required but not set in .env");
    console.error("Get your API key at: https://openweathermap.org/api");
    process.exit(1);
  }

  // Crowd polling is optional
  const crowdEnabled = !!BESTTIME_API_KEY_PRIVATE;
  
  // Transit polling is optional (enabled if API key is set)
  const transitEnabled = !!TRANSITLAND_API_KEY;

  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Weather poll interval: ${WEATHER_POLL_INTERVAL_SEC}s`);
  console.log(`Crowd poll interval: ${CROWD_POLL_INTERVAL_SEC}s`);
  console.log(`Transit poll interval: ${TRANSIT_POLL_INTERVAL_SEC}s`);
  console.log(
    `Crowd detection: ${crowdEnabled ? "✓ ENABLED (BestTime real API)" : "✗ DISABLED (BESTTIME_API_KEY_PRIVATE not set)"}`
  );
  console.log(
    `Transit monitoring: ${transitEnabled ? "✓ ENABLED (Transitland)" : "✗ DISABLED (TRANSITLAND_API_KEY not set)"}`
  );

  if (crowdEnabled) {
    console.log(`Max venues per trip: ${MAX_CROWD_VENUES_PER_TRIP}`);
  }
  
  if (transitEnabled) {
    console.log(`Transit delay threshold: ${TRANSIT_DELAY_THRESHOLD_MIN} minutes`);
    console.log(`Transit stops search radius: ${TRANSIT_STOPS_RADIUS_M}m`);
    console.log(`Max stops per trip: ${TRANSIT_MAX_STOPS}`);
    console.log(`Transitland base URL: ${TRANSITLAND_BASE_URL}`);
  }

  // Wait for API server to be ready
  console.log("Waiting for API server to be ready...");
  let apiReady = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max wait
  
  while (!apiReady && attempts < maxAttempts) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        apiReady = true;
        console.log("✓ API server is ready");
      }
    } catch (error) {
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  if (!apiReady) {
    console.error("✗ API server did not become ready in time. Exiting...");
    process.exit(1);
  }

  // Initial polls
  await pollWeather();
  if (crowdEnabled) {
    await pollCrowds();
  }
  if (transitEnabled) {
    await pollTransit();
  }

  // Set up intervals
  setInterval(async () => {
    await pollWeather();
  }, WEATHER_POLL_INTERVAL_SEC * 1000);

  if (crowdEnabled) {
    setInterval(async () => {
      await pollCrowds();
    }, CROWD_POLL_INTERVAL_SEC * 1000);
  }

  if (transitEnabled) {
    setInterval(async () => {
      await pollTransit();
    }, TRANSIT_POLL_INTERVAL_SEC * 1000);
  }

  console.log("Worker started");
}

start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
