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
 * Falls back to mock data if API key is missing or request fails
 */
export async function fetchBestTimeCrowd(
  args: FetchBestTimeCrowdArgs
): Promise<BestTimeCrowdResult> {
  const { apiKey, name, lat, lng, address } = args;

  // If no API key, return fallback
  if (!apiKey || apiKey.trim() === "") {
    console.warn("BestTime API key not configured, using fallback data");
    return generateFallbackData();
  }

  try {
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
      console.warn(
        `BestTime API returned ${response.status}, using fallback data`
      );
      return generateFallbackData();
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
  } catch (error) {
    console.error("Failed to fetch BestTime crowd data:", error);
    return generateFallbackData();
  }
}

/**
 * Extract current busyness from BestTime response
 */
function extractBusyNow(data: any): number {
  try {
    // Try to get current hour's busyness
    const analysis = data?.analysis;
    if (!analysis) return generateRandomBusyness();

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

    // Fallback to random
    return generateRandomBusyness();
  } catch (error) {
    return generateRandomBusyness();
  }
}

/**
 * Extract peak hours from BestTime response
 * Returns hours where busyness >= 75
 */
function extractPeakHours(data: any): string[] {
  try {
    const analysis = data?.analysis;
    if (!analysis || !Array.isArray(analysis.hour_analysis)) {
      return ["17:00", "18:00"]; // Default fallback
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

    // If no peak hours found, return default
    if (peakHours.length === 0) {
      return ["17:00", "18:00"];
    }

    return peakHours;
  } catch (error) {
    return ["17:00", "18:00"];
  }
}

/**
 * Generate fallback crowd data when API is unavailable
 */
function generateFallbackData(): BestTimeCrowdResult {
  return {
    busyNow: generateRandomBusyness(),
    peakHours: ["17:00", "18:00"],
    raw: { fallback: true },
  };
}

/**
 * Generate random busyness between 20-80
 */
function generateRandomBusyness(): number {
  return Math.floor(Math.random() * 61) + 20; // 20-80
}
