/**
 * Signals routes - Weather and crowd signals
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  SignalsResponseSchema,
  UpsertWeatherSignalRequestSchema,
  UpsertCrowdSignalRequestSchema,
  UpsertTransitSignalRequestSchema,
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
        
        // Get crowd signals
        const crowdSignal = store.getCrowdSignals(tripId);
        
        // Get transit signals
        const transitSignal = store.getTransitSignals(tripId);

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
          crowds: crowdSignal ? crowdSignal.crowds : [],
          transit: transitSignal
            ? { alerts: transitSignal.alerts }
            : { alerts: [] },
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

  // POST /internal/trip/:tripId/signals/crowds - Update crowd signals (internal use)
  app.post(
    "/internal/trip/:tripId/signals/crowds",
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
        const body = UpsertCrowdSignalRequestSchema.parse(request.body);

        // Store crowd signals
        store.upsertCrowdSignals(tripId, {
          observedAt: body.observedAt,
          crowds: body.crowds,
          raw: body.raw,
        });

        console.log(`[Crowds] Updated crowd signals for trip ${tripId}: ${body.crowds.length} places`);

        // Emit SSE event
        sseHub.emit(tripId, "signal:update", {
          type: "crowds",
          observedAt: body.observedAt,
        });

        return reply.send({ ok: true });
      } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
          return reply.code(400).send({ error: "Invalid request data", details: error });
        }
        console.error("Error upserting crowd signals:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /internal/trip/:tripId/signals/transit - Update transit signals (internal use)
  app.post(
    "/internal/trip/:tripId/signals/transit",
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
        const body = UpsertTransitSignalRequestSchema.parse(request.body);

        // Store transit signals
        store.upsertTransitSignals(tripId, {
          observedAt: body.observedAt,
          alerts: body.transit.alerts,
          raw: body.raw,
        });

        console.log(`[Transit] Updated transit signals for trip ${tripId}: ${body.transit.alerts.length} alerts`);

        // Emit SSE event
        sseHub.emit(tripId, "signal:update", {
          type: "transit",
          observedAt: body.observedAt,
        });

        return reply.send({ ok: true });
      } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
          return reply.code(400).send({ error: "Invalid request data", details: error });
        }
        console.error("Error upserting transit signals:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
