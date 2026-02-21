/**
 * Signals routes - Weather and other real-time signals
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  SignalsResponseSchema,
  UpsertWeatherSignalRequestSchema,
} from "@adaptive/types";
import * as store from "../store/store.js";
import * as sseHub from "../realtime/sseHub.js";

/**
 * Register signals routes
 */
export async function registerSignalsRoutes(app: FastifyInstance) {
  // GET /trip/:tripId/signals - Get current signals for a trip
  app.get(
    "/trip/:tripId/signals",
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

        // Get weather signal
        const weatherSignal = store.getWeatherSignal(tripId);

        const response = SignalsResponseSchema.parse({
          weather: weatherSignal
            ? {
                summary: weatherSignal.summary,
                riskHours: weatherSignal.riskHours,
              }
            : {
                summary: "No data yet",
                riskHours: [],
              },
        });

        return reply.send(response);
      } catch (error) {
        console.error("Error getting signals:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /internal/trip/:tripId/signals/weather - Update weather signal (internal use)
  app.post(
    "/internal/trip/:tripId/signals/weather",
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
        const body = UpsertWeatherSignalRequestSchema.parse(request.body);

        // Store weather signal
        store.upsertWeatherSignal(tripId, {
          observedAt: body.observedAt,
          summary: body.weather.summary,
          riskHours: body.weather.riskHours,
          raw: body.raw,
        });

        // Emit SSE event
        sseHub.emit(tripId, "signal:update", {
          weather: {
            summary: body.weather.summary,
            riskHours: body.weather.riskHours,
          },
        });

        return reply.send({ ok: true });
      } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
          return reply.code(400).send({ error: "Invalid request data", details: error });
        }
        console.error("Error upserting weather signal:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
