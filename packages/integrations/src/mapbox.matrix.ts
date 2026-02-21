/**
 * Mapbox Matrix API response types
 */
interface MapboxMatrixResponse {
  code: string;
  durations: number[][];
  destinations: Array<{
    location: [number, number];
  }>;
  sources: Array<{
    location: [number, number];
  }>;
}

/**
 * Get travel duration matrix using Mapbox Matrix API
 * @param profile - Routing profile (e.g., "mapbox/driving", "mapbox/walking", "mapbox/driving-traffic")
 * @param coordinates - Array of [lng, lat] coordinates
 * @param accessToken - Mapbox access token
 * @returns Duration matrix in seconds (sources x destinations)
 */
export async function getDurationMatrixMapbox(
  profile: string,
  coordinates: Array<{ lat: number; lng: number }>,
  accessToken: string = ""
): Promise<number[][]> {
  if (!accessToken) {
    throw new Error("Mapbox access token is required");
  }

  if (coordinates.length < 2) {
    throw new Error("At least 2 coordinates are required");
  }

  if (coordinates.length > 25) {
    throw new Error("Mapbox Matrix API supports a maximum of 25 coordinates");
  }

  // IMPORTANT: driving-traffic profile has a lower limit (10 coords) than other profiles (25 coords)
  // If using driving-traffic with more than 10 coords, fallback to standard driving
  let actualProfile = profile;
  if (profile === "mapbox/driving-traffic" && coordinates.length > 10) {
    console.log(
      `Mapbox: falling back from driving-traffic to driving (${coordinates.length} coords > 10)`
    );
    actualProfile = "mapbox/driving";
  }

  // Format coordinates as "lng,lat;lng,lat;..." (note: lng comes first!)
  const coordsString = coordinates
    .map((coord) => `${coord.lng},${coord.lat}`)
    .join(";");

  const url = `https://api.mapbox.com/directions-matrix/v1/${actualProfile}/${coordsString}?annotations=duration&access_token=${accessToken}`;

  console.log("Mapbox API URL:", url.substring(0, 100) + "...");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Mapbox API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json() as MapboxMatrixResponse;

    if (data.code !== "Ok") {
      throw new Error(`Mapbox API returned code: ${data.code}`);
    }

    return data.durations;
  } catch (error) {
    console.error("Mapbox API error details:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to get Mapbox duration matrix: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Helper function to get valid Mapbox profile from mode
 * @param mode - Travel mode (walking, driving, transit)
 * @param trafficProfile - Optional traffic-aware profile (e.g., "mapbox/driving-traffic")
 * @returns Mapbox profile string
 */
export function getMapboxProfile(
  mode: "driving" | "walking" | "transit",
  trafficProfile: string = "mapbox/driving-traffic"
): string {
  switch (mode) {
    case "driving":
      // Prefer traffic-aware profile for driving
      return trafficProfile || "mapbox/driving-traffic";
    case "walking":
      return "mapbox/walking";
    case "transit":
      // Mapbox doesn't have a transit profile, use driving as baseline
      return "mapbox/driving";
    default:
      return "mapbox/driving";
  }
}
