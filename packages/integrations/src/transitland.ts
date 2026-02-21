/**
 * Transitland API client for transit delays and service alerts
 * Documentation: https://www.transit.land/documentation/rest-api
 */

export interface TransitlandStop {
  stop_key: string;
  stop_name: string;
}

export interface TransitlandDeparturesResponse {
  stops?: Array<{
    stop_id?: string;
    stop_name?: string;
  }>;
  departures?: Array<{
    trip?: {
      route_id?: string;
      route_short_name?: string;
      route_long_name?: string;
    };
    departure_time?: string; // HH:MM:SS format
    arrival_time?: string;
    delay?: number; // in seconds
    scheduled_departure_time?: string;
    estimated_departure_time?: string;
  }>;
  alerts?: Array<{
    header_text?: string;
    description_text?: string;
    effect?: string;
    cause?: string;
  }>;
}

export interface TransitAlert {
  line: string;
  delayMin: number;
  message: string;
}

/**
 * Find transit stops near a location
 * @param params - Search parameters
 * @returns Array of stops
 */
export async function transitlandFindStopsNear(params: {
  lat: number;
  lon: number;
  radiusM: number;
  limit: number;
  apiKey: string;
  baseUrl?: string;
}): Promise<TransitlandStop[]> {
  const { lat, lon, radiusM, limit, apiKey, baseUrl = "https://transit.land/api/v2/rest" } = params;

  if (!apiKey) {
    console.warn("Transitland API key not provided");
    return [];
  }

  try {
    const url = `${baseUrl}/stops?lat=${lat}&lon=${lon}&radius=${radiusM}&limit=${limit}&apikey=${apiKey}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Transitland API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    
    // Parse stops from response
    const stops: TransitlandStop[] = [];
    if (data.stops && Array.isArray(data.stops)) {
      for (const stop of data.stops) {
        stops.push({
          stop_key: stop.onestop_id || stop.id || stop.stop_id || "",
          stop_name: stop.stop_name || stop.name || "Unknown Stop",
        });
      }
    }

    return stops;
  } catch (error) {
    console.error("Transitland findStopsNear error:", error);
    return [];
  }
}

/**
 * Get departures for a specific stop
 * @param params - Request parameters
 * @returns Departures response
 */
export async function transitlandGetDepartures(params: {
  stopKey: string;
  nextSeconds: number;
  includeAlerts: boolean;
  apiKey: string;
  baseUrl?: string;
}): Promise<TransitlandDeparturesResponse> {
  const { stopKey, nextSeconds, includeAlerts, apiKey, baseUrl = "https://transit.land/api/v2/rest" } = params;

  if (!apiKey) {
    console.warn("Transitland API key not provided");
    return {};
  }

  try {
    const url = `${baseUrl}/stops/${encodeURIComponent(stopKey)}/departures?next=${nextSeconds}&include_alerts=${includeAlerts ? "true" : "false"}&apikey=${apiKey}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Transitland API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    return data as TransitlandDeparturesResponse;
  } catch (error) {
    console.error("Transitland getDepartures error:", error);
    return {};
  }
}

/**
 * Extract transit alerts from departures response
 * @param response - Departures response from Transitland
 * @returns Array of transit alerts
 */
export function extractTransitAlertsFromDepartures(
  response: TransitlandDeparturesResponse
): TransitAlert[] {
  const alerts: TransitAlert[] = [];

  // Extract alerts from service alerts
  if (response.alerts && Array.isArray(response.alerts)) {
    for (const alert of response.alerts) {
      const message = alert.header_text || alert.description_text || "Service disruption";
      
      // Try to infer delay from effect/cause
      let delayMin = 0;
      if (alert.effect) {
        const effect = alert.effect.toLowerCase();
        if (effect.includes("significant_delays") || effect.includes("delays")) {
          delayMin = 15; // Assume significant delays = 15 min
        } else if (effect.includes("reduced_service")) {
          delayMin = 10;
        } else if (effect.includes("detour")) {
          delayMin = 5;
        }
      }

      alerts.push({
        line: "Transit",
        delayMin,
        message: message.substring(0, 200), // Limit message length
      });
    }
  }

  // Extract delays from departures
  if (response.departures && Array.isArray(response.departures)) {
    const delaysByLine = new Map<string, number>();

    for (const departure of response.departures) {
      try {
        // Get route/line name
        const routeName =
          departure.trip?.route_short_name ||
          departure.trip?.route_long_name ||
          "Transit";

        // Calculate delay
        let delayMin = 0;

        // Option 1: Use delay field (in seconds)
        if (typeof departure.delay === "number") {
          delayMin = Math.round(Math.abs(departure.delay) / 60);
        }
        // Option 2: Compare scheduled vs estimated times
        else if (departure.scheduled_departure_time && departure.estimated_departure_time) {
          const scheduled = parseTimeToMinutes(departure.scheduled_departure_time);
          const estimated = parseTimeToMinutes(departure.estimated_departure_time);
          if (scheduled !== null && estimated !== null) {
            delayMin = Math.round(Math.abs(estimated - scheduled));
          }
        }
        // Option 3: Compare departure_time vs estimated
        else if (departure.departure_time && departure.estimated_departure_time) {
          const scheduled = parseTimeToMinutes(departure.departure_time);
          const estimated = parseTimeToMinutes(departure.estimated_departure_time);
          if (scheduled !== null && estimated !== null) {
            delayMin = Math.round(Math.abs(estimated - scheduled));
          }
        }

        // Track max delay per line
        if (delayMin > 0) {
          const currentMax = delaysByLine.get(routeName) || 0;
          if (delayMin > currentMax) {
            delaysByLine.set(routeName, delayMin);
          }
        }
      } catch (error) {
        // Skip invalid departures
        console.warn("Error parsing departure:", error);
      }
    }

    // Add delay alerts
    for (const [line, delayMin] of delaysByLine.entries()) {
      if (delayMin > 0) {
        alerts.push({
          line,
          delayMin,
          message: `Delay on upcoming departures`,
        });
      }
    }
  }

  // Sort by delay (highest first) and keep top 5
  alerts.sort((a, b) => b.delayMin - a.delayMin);
  return alerts.slice(0, 5);
}

/**
 * Parse time string (HH:MM:SS or HH:MM) to minutes since midnight
 * @param timeStr - Time string
 * @returns Minutes since midnight or null if invalid
 */
function parseTimeToMinutes(timeStr: string): number | null {
  try {
    const parts = timeStr.split(":");
    if (parts.length < 2) return null;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    return hours * 60 + minutes;
  } catch {
    return null;
  }
}
