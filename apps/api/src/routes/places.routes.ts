import type { FastifyInstance } from "fastify";
import {
  PlacesSearchRequestSchema,
  PlacesSearchResponseSchema,
  type PlacesSearchRequest,
  type Place,
} from "@adaptive/types";
import { searchPlacesFoursquare } from "@adaptive/integrations";

export async function registerPlacesRoutes(app: FastifyInstance) {
  // POST /places/search - Search for places
  app.post<{ Body: PlacesSearchRequest }>("/places/search", async (req, reply) => {
    try {
      // Validate request body
      const body = PlacesSearchRequestSchema.parse(req.body);
      const { query, near, radiusKm = 10, categories, limit = 20 } = body;

      const apiKey = process.env.FOURSQUARE_API_KEY || "";

      let places: Place[];

      if (!apiKey) {
        // Return mock places if no API key is configured
        console.warn("FOURSQUARE_API_KEY not configured, returning mock places");
        places = generateMockPlaces(query, near, limit);
      } else {
        // Call Foursquare API with real API key
        places = await searchPlacesFoursquare(
          query,
          near,
          radiusKm,
          categories,
          limit,
          apiKey
        );
      }

      const response = PlacesSearchResponseSchema.parse({ places });
      return reply.code(200).send(response);
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(400).send({
          error: "Bad Request",
          message: error.message,
        });
      }
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Failed to search places",
      });
    }
  });
}

/**
 * Generate mock places for testing when API key is not available
 */
function generateMockPlaces(
  query: string,
  near: { lat: number; lng: number },
  limit: number
): Place[] {
  const mockPlaces: Place[] = [
    {
      provider: "mock",
      providerPlaceId: "mock-1",
      name: `${query} Place 1`,
      lat: near.lat + 0.01,
      lng: near.lng + 0.01,
      category: "Tourist Attraction",
      address: "123 Main St",
    },
    {
      provider: "mock",
      providerPlaceId: "mock-2",
      name: `${query} Place 2`,
      lat: near.lat - 0.01,
      lng: near.lng + 0.01,
      category: "Museum",
      address: "456 Oak Ave",
    },
    {
      provider: "mock",
      providerPlaceId: "mock-3",
      name: `${query} Place 3`,
      lat: near.lat + 0.02,
      lng: near.lng - 0.01,
      category: "Park",
      address: "789 Park Blvd",
    },
  ];

  return mockPlaces.slice(0, Math.min(limit, mockPlaces.length));
}
