/**
 * BestTime API integration for crowd/busyness data
 * API docs: https://besttime.app/
 */

export interface FetchBestTimeCrowdArgs {
  apiKey: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export interface BestTimeCrowdResult {
  busyNow: number; // 0..100
  peakHours: string[]; // ["17:00", "18:00"]
  raw: any;
}

/**
 * Fetch crowd data from BestTime API
 * Throws error if API key is missing or request fails
 */
export async function fetchBestTimeCrowd(
  args: FetchBestTimeCrowdArgs
): Promise<BestTimeCrowdResult> {
  const { apiKey, name, lat, lng, address } = args;

  // Require API key
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("BESTTIME_API_KEY is required but not configured");
  }

  // Validate API key format (must be private key)
  if (!apiKey.startsWith("pri_")) {
    throw new Error(
      `BestTime API requires a private key (starts with "pri_"). You provided: ${apiKey.substring(0, 4)}... ` +
      `Get your private key at https://besttime.app/api/v1/keys`
    );
  }

  // BestTime API endpoint for venue forecasts
  // Using the "query" endpoint which searches for venues and returns crowd data
  const url = "https://besttime.app/api/v1/forecasts";
  
  const body = {
    api_key_private: apiKey,
    venue_name: name,
    venue_address: address || `${lat},${lng}`,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `BestTime API returned ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();

  // Parse BestTime response
  // Response structure varies, but typically includes:
  // - analysis.venue_forecasted_busyness (current hour forecast)
  // - analysis.hour_analysis (hourly breakdown)
  const busyNow = extractBusyNow(data);
  const peakHours = extractPeakHours(data);

  return {
    busyNow,
    peakHours,
    raw: data,
  };
}

/**
 * Extract current busyness from BestTime response
 */
function extractBusyNow(data: any): number {
  // Try to get current hour's busyness
  const analysis = data?.analysis;
  if (!analysis) {
    throw new Error("BestTime API response missing 'analysis' field");
  }

  // Check for forecasted busyness (0-100 scale)
  if (typeof analysis.venue_forecasted_busyness === "number") {
    return Math.min(100, Math.max(0, analysis.venue_forecasted_busyness));
  }

  // Check for current hour in hour_analysis array
  if (Array.isArray(analysis.hour_analysis)) {
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay(); // 0 = Sunday

    const hourData = analysis.hour_analysis.find(
      (h: any) => h.hour === currentHour && h.day_int === currentDay
    );

    if (hourData && typeof hourData.intensity_nr === "number") {
      return Math.min(100, Math.max(0, hourData.intensity_nr));
    }
  }

  // If no current hour data found, default to 0 (not busy)
  return 0;
}

/**
 * Extract peak hours from BestTime response
 * Returns hours where busyness >= 75
 */
function extractPeakHours(data: any): string[] {
  const analysis = data?.analysis;
  if (!analysis || !Array.isArray(analysis.hour_analysis)) {
    return []; // No peak hours if no data
  }

  const currentDay = new Date().getDay();
  const peakHours: string[] = [];

  for (const hourData of analysis.hour_analysis) {
    // Focus on today's data
    if (hourData.day_int === currentDay) {
      const intensity = hourData.intensity_nr || 0;
      if (intensity >= 75) {
        const hour = String(hourData.hour).padStart(2, "0");
        peakHours.push(`${hour}:00`);
      }
    }
  }

  return peakHours;
}


