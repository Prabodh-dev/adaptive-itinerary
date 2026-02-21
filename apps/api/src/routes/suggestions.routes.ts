/**
 * Suggestions routes - Trip suggestions based on signals
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  ListSuggestionsResponseSchema,
  SuggestionSchema,
  type Suggestion,
} from "@adaptive/types";
import * as store from "../store/store.js";
import * as sseHub from "../realtime/sseHub.js";

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
}
