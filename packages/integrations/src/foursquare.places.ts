import type { Place } from "@adaptive/types";

/**
 * Foursquare Places API (new format) response types
 */
interface FoursquarePlace {
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  location?: {
    formatted_address?: string;
  };
  categories?: Array<{
    fsq_category_id: string;
    name: string;
    short_name: string;
    plural_name: string;
  }>;
}

interface FoursquareSearchResponse {
  results: FoursquarePlace[];
}

/**
 * Search for places using Foursquare Places API (new endpoint)
 * @param query - Search query (e.g., "coffee shops", "museums")
 * @param near - Latitude and longitude to search near
 * @param radiusKm - Search radius in kilometers (default 8km)
 * @param categories - Optional category filters
 * @param limit - Maximum number of results (default 20)
 * @param apiKey - Foursquare API key
 * @returns Array of Place objects
 */
export async function searchPlacesFoursquare(
  query: string,
  near: { lat: number; lng: number },
  radiusKm: number = 8,
  categories?: string[],
  limit: number = 20,
  apiKey: string = ""
): Promise<Place[]> {
  if (!apiKey) {
    throw new Error("Foursquare API key is required");
  }

  // Build query parameters
  const params = new URLSearchParams({
    query,
    ll: `${near.lat},${near.lng}`,
    radius: String(radiusKm * 1000), // Convert km to meters
    limit: String(limit),
  });

  if (categories && categories.length > 0) {
    params.append("categories", categories.join(","));
  }

  const url = `https://places-api.foursquare.com/places/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Foursquare API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json() as FoursquareSearchResponse;

    // Map Foursquare results to Place schema
    return data.results.map((fsPlace) => {
      const place: Place = {
        provider: "foursquare",
        providerPlaceId: fsPlace.fsq_place_id,
        name: fsPlace.name,
        lat: fsPlace.latitude,
        lng: fsPlace.longitude,
      };

      // Optional fields
      if (fsPlace.location?.formatted_address) {
        place.address = fsPlace.location.formatted_address;
      }

      if (fsPlace.categories && fsPlace.categories.length > 0) {
        place.category = fsPlace.categories[0].name;
      }

      return place;
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search Foursquare places: ${error.message}`);
    }
    throw error;
  }
}
