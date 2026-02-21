/**
 * Trip routes - API endpoints for trip management
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  CreateTripRequestSchema,
  CreateTripResponseSchema,
  AddActivitiesRequestSchema,
  AddActivitiesResponseSchema,
  GenerateItineraryRequestSchema,
  GenerateItineraryResponseSchema,
  GetTripResponseSchema,
} from "@adaptive/types";
import * as store from "../store/store.js";
import { generateItinerary } from "../services/planner.service.js";
import { buildWeatherSuggestion, buildCrowdSuggestion, buildTransitSuggestion } from "../services/suggestion.service.js";
import { emit } from "../realtime/sseHub.js";

/**
 * Register trip routes
 */
export async function registerTripRoutes(app: FastifyInstance) {
  // POST /trip - Create a new trip
  app.post("/trip", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = CreateTripRequestSchema.parse(request.body);
      const { tripId } = store.createTrip(body);

      const response = CreateTripResponseSchema.parse({ tripId });
      return reply.code(201).send(response);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return reply.code(400).send({ error: "Invalid request data", details: error });
      }
      console.error("Error creating trip:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /trip/:tripId - Get trip details
  app.get(
    "/trip/:tripId",
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tripId } = request.params;
        const tripData = store.getTrip(tripId);

        if (!tripData) {
          return reply.code(404).send({ error: "Trip not found" });
        }

        const response = GetTripResponseSchema.parse(tripData);
        return reply.send(response);
      } catch (error) {
        console.error("Error getting trip:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /trip/:tripId/activities - Add activities to a trip
  app.post(
    "/trip/:tripId/activities",
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tripId } = request.params;
        const body = AddActivitiesRequestSchema.parse(request.body);

        // Verify trip exists
        const tripData = store.getTrip(tripId);
        if (!tripData) {
          return reply.code(404).send({ error: "Trip not found" });
        }

        const count = store.upsertActivities(tripId, body.activities);
        const response = AddActivitiesResponseSchema.parse({ ok: true, count });

        return reply.send(response);
      } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
          return reply.code(400).send({ error: "Invalid request data", details: error });
        }
        console.error("Error adding activities:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /trip/:tripId/itinerary/generate - Generate itinerary
  app.post(
    "/trip/:tripId/itinerary/generate",
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tripId } = request.params;
        const body = GenerateItineraryRequestSchema.parse(request.body);

        // Get trip and activities
        const tripData = store.getTrip(tripId);
        if (!tripData) {
          return reply.code(404).send({ error: "Trip not found" });
        }

        const { trip, activities } = tripData;

        if (activities.length === 0) {
          return reply
            .code(400)
            .send({ error: "Cannot generate itinerary without activities" });
        }

        // Generate itinerary
        const itinerary = await generateItinerary({
          trip,
          activities,
          mode: body.mode || "driving",
          startLocation: body.startLocation,
          optimizeOrder: body.optimizeOrder ?? true,
        });

        // Store the itinerary
        const version = store.addItineraryVersion(tripId, itinerary);

        const response = GenerateItineraryResponseSchema.parse({
          version,
          itinerary,
        });

        return reply.send(response);
      } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
          return reply.code(400).send({ error: "Invalid request data", details: error });
        }
        console.error("Error generating itinerary:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /trips - Get all trip IDs (for worker)
  app.get("/trips", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tripIds = store.getTripIds();
      return reply.send({ tripIds });
    } catch (error) {
      console.error("Error getting trip IDs:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // POST /internal/trip/:tripId/recompute - Recompute suggestions based on latest data
  app.post(
    "/internal/trip/:tripId/recompute",
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tripId } = request.params;

        // Get trip data
        const tripData = store.getTrip(tripId);
        if (!tripData) {
          return reply.code(404).send({ error: "Trip not found" });
        }

        const { trip, activities, latestItinerary } = tripData;

        // Get weather signal
        const weatherSignal = store.getWeatherSignal(tripId);
        
        // Get crowd signals
        const crowdSignal = store.getCrowdSignals(tripId);
        
        // Get transit signals
        const transitSignal = store.getTransitSignals(tripId);

        // Build weather suggestion
        const weatherSuggestion = buildWeatherSuggestion(
          trip,
          activities,
          latestItinerary?.itinerary,
          weatherSignal
        );
        
        // Build crowd suggestion
        const crowdSuggestion = buildCrowdSuggestion(
          trip,
          activities,
          latestItinerary?.itinerary,
          crowdSignal
        );
        
        // Build transit suggestion
        const transitSuggestion = buildTransitSuggestion(
          trip,
          activities,
          latestItinerary?.itinerary,
          transitSignal
        );

        const suggestions = [weatherSuggestion, crowdSuggestion, transitSuggestion].filter(Boolean);

        if (suggestions.length > 0) {
          // Store and emit each suggestion
          for (const suggestion of suggestions) {
            if (suggestion) {
              store.addSuggestion(tripId, suggestion);
              emit(tripId, "suggestion:new", suggestion);
            }
          }

          return reply.send({ ok: true, suggestions });
        }

        return reply.send({ ok: true, suggestions: [] });
      } catch (error) {
        console.error("Error recomputing suggestions:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
