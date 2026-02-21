/**
 * Suggestions routes - Trip suggestions based on signals
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  ListSuggestionsResponseSchema,
  SuggestionSchema,
  FeedbackRequestSchema,
  FeedbackResponseSchema,
  ApplySuggestionResponseSchema,
  type Suggestion,
  type FeedbackRequest,
  type Itinerary,
  type ItineraryItem,
} from "@adaptive/types";
import * as store from "../store/store.js";
import * as sseHub from "../realtime/sseHub.js";
import { parseHHMM, formatHHMM } from "../utils/time.js";

/**
 * Register suggestions routes
 */
export async function registerSuggestionsRoutes(app: FastifyInstance) {
  // GET /trip/:tripId/suggestions - List suggestions for a trip
  app.get(
    "/trip/:tripId/suggestions",
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Querystring: { status?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { tripId } = request.params;
        const { status } = request.query;

        // Check if trip exists
        const tripData = store.getTrip(tripId);
        if (!tripData) {
          return reply.code(404).send({ error: "Trip not found" });
        }

        // Get suggestions
        const suggestions = store.listSuggestions(tripId, status);

        const response = ListSuggestionsResponseSchema.parse({
          suggestions,
        });

        return reply.send(response);
      } catch (error) {
        console.error("Error listing suggestions:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /internal/trip/:tripId/suggestions - Create a suggestion (internal use)
  app.post(
    "/internal/trip/:tripId/suggestions",
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tripId } = request.params;

        // Check if trip exists
        const tripData = store.getTrip(tripId);
        if (!tripData) {
          return reply.code(404).send({ error: "Trip not found" });
        }

        // Validate request body
        const suggestion = SuggestionSchema.parse(request.body) as Suggestion;

        // Store suggestion
        store.addSuggestion(tripId, suggestion);

        // Emit SSE event
        sseHub.emit(tripId, "suggestion:new", suggestion);

        return reply.send({ ok: true, suggestionId: suggestion.suggestionId });
      } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
          return reply.code(400).send({ error: "Invalid request data", details: error });
        }
        console.error("Error creating suggestion:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /trip/:tripId/feedback - Submit feedback for a suggestion
  app.post(
    "/trip/:tripId/feedback",
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tripId } = request.params;

        // Check if trip exists
        const tripData = store.getTrip(tripId);
        if (!tripData) {
          return reply.code(404).send({ error: "Trip not found" });
        }

        // Validate request body
        const feedback = FeedbackRequestSchema.parse(request.body) as FeedbackRequest;

        // Get the suggestion
        const suggestion = store.getSuggestion(tripId, feedback.suggestionId);
        if (!suggestion) {
          return reply.code(404).send({ error: "Suggestion not found" });
        }

        // Update suggestion status
        const newStatus = feedback.action === "accept" ? "accepted" : "rejected";
        store.setSuggestionStatus(tripId, feedback.suggestionId, newStatus);

        // Update weights based on feedback
        const updatedWeights = store.updateWeights(tripId, {
          trigger: suggestion.trigger,
          accepted: feedback.action === "accept",
        });

        const response = FeedbackResponseSchema.parse({
          ok: true,
          weights: updatedWeights,
        });

        return reply.send(response);
      } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
          return reply.code(400).send({ error: "Invalid request data", details: error });
        }
        console.error("Error processing feedback:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /trip/:tripId/suggestions/:suggestionId/apply - Apply a suggestion
  app.post(
    "/trip/:tripId/suggestions/:suggestionId/apply",
    async (
      request: FastifyRequest<{
        Params: { tripId: string; suggestionId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { tripId, suggestionId } = request.params;

        // Check if trip exists
        const tripData = store.getTrip(tripId);
        if (!tripData) {
          return reply.code(404).send({ error: "Trip not found" });
        }

        // Get the suggestion
        const suggestion = store.getSuggestion(tripId, suggestionId);
        if (!suggestion) {
          return reply.code(404).send({ error: "Suggestion not found" });
        }

        // Check if suggestion can be applied
        if (suggestion.status !== "pending" && suggestion.status !== "accepted") {
          return reply.code(400).send({ 
            error: "Suggestion cannot be applied", 
            currentStatus: suggestion.status 
          });
        }

        // Get trip start time for recalculating
        const tripStartMin = parseHHMM(tripData.trip.startTime);

        // Recalculate times based on new order
        const recalculatedItems: ItineraryItem[] = [];
        let currentTimeMin = tripStartMin;

        for (let i = 0; i < suggestion.afterPlan.items.length; i++) {
          const item = suggestion.afterPlan.items[i];
          const travelFromPrevMin = i === 0 ? 0 : item.travelFromPrevMin;
          const startTime = currentTimeMin + travelFromPrevMin;
          const endTime = startTime + (parseHHMM(item.endTime) - parseHHMM(item.startTime));

          recalculatedItems.push({
            ...item,
            startTime: formatHHMM(startTime),
            endTime: formatHHMM(endTime),
            travelFromPrevMin,
          });

          currentTimeMin = endTime;
        }

        // Create new itinerary version from recalculated items
        const newItinerary: Itinerary = {
          items: recalculatedItems,
          totalTravelMin: recalculatedItems.reduce(
            (sum, item) => sum + item.travelFromPrevMin, 
            0
          ),
        };

        const newVersion = store.addItineraryVersion(tripId, newItinerary);

        // Update suggestion status to applied
        store.setSuggestionStatus(tripId, suggestionId, "applied");

        // Emit SSE event for new itinerary version
        sseHub.emit(tripId, "itinerary:version", { 
          version: newVersion,
          itinerary: newItinerary,
        });

        const response = ApplySuggestionResponseSchema.parse({
          version: newVersion,
          itinerary: newItinerary,
        });

        return reply.send(response);
      } catch (error) {
        console.error("Error applying suggestion:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
