/**
 * BestTime API Real-Time Crowd Detection
 * API Docs: https://besttime.app/api-documentation/
 */

const BESTTIME_API_BASE = "https://besttime.app/api/v1";
const REQUEST_TIMEOUT_MS = 20000; // Increased to 20 seconds for slow API responses

// ============================================================================
// Types
// ============================================================================

export interface BesttimeNewForecastArgs {
  apiKeyPrivate: string;
  venueName: string;
  venueAddress: string;
}

export interface BesttimeNewForecastResult {
  venueId: string | null;
  analysis: any | null; // Contains busy_hours arrays per day_int
  raw: any;
}

export interface BesttimeLiveArgs {
  apiKeyPrivate: string;
  venueId?: string;
  venueName?: string;
  venueAddress?: string;
}

export interface BesttimeLiveResult {
  liveAvailable: boolean;
  liveBusyness: number | null; // May exceed 100
  forecastedBusyness: number | null; // 0..100
  hourStart: number | null;
  raw: any;
}

// ============================================================================
// New Forecast (to get venue_id + busy hours)
// ============================================================================

/**
 * Call BestTime New Forecast endpoint
 * POST https://besttime.app/api/v1/forecasts
 * 
 * Returns venue_id and analysis with busy_hours per day_int
 */
export async function besttimeNewForecast(
  args: BesttimeNewForecastArgs
): Promise<BesttimeNewForecastResult> {
  const { apiKeyPrivate, venueName, venueAddress } = args;

  const url = new URL(`${BESTTIME_API_BASE}/forecasts`);
  url.searchParams.append("api_key_private", apiKeyPrivate);
  url.searchParams.append("venue_name", venueName);
  url.searchParams.append("venue_address", venueAddress);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[BestTime] New forecast failed: ${response.status} ${response.statusText}`
      );
      return { venueId: null, analysis: null, raw: null };
    }

    const data = await response.json() as {
      venue_info?: { venue_id?: string };
      venue_id?: string;
      analysis?: any;
    };

    // Extract venue_id
    const venueId = data?.venue_info?.venue_id || data?.venue_id || null;

    // Extract analysis
    const analysis = data?.analysis || null;

    return {
      venueId,
      analysis,
      raw: data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[BestTime] New forecast error:", error);
    return { venueId: null, analysis: null, raw: null };
  }
}

// ============================================================================
// Live Foot-Traffic (to get live busyness now vs forecast)
// ============================================================================

/**
 * Call BestTime Live endpoint
 * POST https://besttime.app/api/v1/forecasts/live
 * Fallback: https://besttime.app/api/v1/forecast/live (if 404)
 * 
 * Returns live busyness and forecasted busyness for current hour
 */
export async function besttimeLive(
  args: BesttimeLiveArgs
): Promise<BesttimeLiveResult> {
  const { apiKeyPrivate, venueId, venueName, venueAddress } = args;

  // Try primary endpoint first
  let result = await tryLiveEndpoint(
    `${BESTTIME_API_BASE}/forecasts/live`,
    apiKeyPrivate,
    venueId,
    venueName,
    venueAddress
  );

  // If 404, try fallback endpoint
  if (result === null) {
    result = await tryLiveEndpoint(
      `${BESTTIME_API_BASE}/forecast/live`,
      apiKeyPrivate,
      venueId,
      venueName,
      venueAddress
    );
  }

  if (result === null) {
    return {
      liveAvailable: false,
      liveBusyness: null,
      forecastedBusyness: null,
      hourStart: null,
      raw: null,
    };
  }

  return result;
}

async function tryLiveEndpoint(
  baseUrl: string,
  apiKeyPrivate: string,
  venueId?: string,
  venueName?: string,
  venueAddress?: string
): Promise<BesttimeLiveResult | null> {
  const url = new URL(baseUrl);
  url.searchParams.append("api_key_private", apiKeyPrivate);

  // Prefer venue_id, fallback to venue_name + venue_address
  if (venueId) {
    url.searchParams.append("venue_id", venueId);
  } else if (venueName && venueAddress) {
    url.searchParams.append("venue_name", venueName);
    url.searchParams.append("venue_address", venueAddress);
  } else {
    console.warn("[BestTime] Live requires venue_id OR (venue_name + venue_address)");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 404) {
      // Endpoint not found, caller should try fallback
      return null;
    }

    if (!response.ok) {
      console.warn(
        `[BestTime] Live failed: ${response.status} ${response.statusText}`
      );
      return {
        liveAvailable: false,
        liveBusyness: null,
        forecastedBusyness: null,
        hourStart: null,
        raw: null,
      };
    }

    const data = await response.json() as {
      analysis?: { venue_live_busyness?: number; venue_forecasted_busyness?: number; hour_start?: number };
      venue_info?: Record<string, unknown>;
    };

    // Parse live data
    const analysis = data?.analysis || {};

    // Live busyness (may exceed 100)
    const liveBusyness =
      typeof analysis.venue_live_busyness === "number"
        ? analysis.venue_live_busyness
        : null;

    // Forecasted busyness (0..100)
    const forecastedBusyness =
      typeof analysis.venue_forecasted_busyness === "number"
        ? analysis.venue_forecasted_busyness
        : null;

    // Hour start
    const hourStart =
      typeof analysis.hour_start === "number" ? analysis.hour_start : null;

    const liveAvailable = liveBusyness !== null;

    return {
      liveAvailable,
      liveBusyness,
      forecastedBusyness,
      hourStart,
      raw: data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as any).name === "AbortError") {
      console.warn("[BestTime] Live request timeout");
    } else {
      console.error("[BestTime] Live error:", error);
    }
    return {
      liveAvailable: false,
      liveBusyness: null,
      forecastedBusyness: null,
      hourStart: null,
      raw: null,
    };
  }
}
