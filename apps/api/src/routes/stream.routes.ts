/**
 * Stream routes - Server-Sent Events for real-time updates
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as store from "../store/store.js";
import * as sseHub from "../realtime/sseHub.js";

/**
 * Register stream routes
 */
export async function registerStreamRoutes(app: FastifyInstance) {
  // GET /trip/:tripId/stream - SSE endpoint for trip updates
  app.get(
    "/trip/:tripId/stream",
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply
    ) => {
      const { tripId } = request.params;

      // Check if trip exists
      const tripData = store.getTrip(tripId);
      if (!tripData) {
        app.log.warn(`SSE connection attempted for non-existent trip: ${tripId}`);
        return reply.code(404).send({ error: "Trip not found" });
      }

      app.log.info(`SSE connection established for trip: ${tripId}`);

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      // Register client
      sseHub.addClient(tripId, reply.raw);

      // Send initial ping with current weather signal
      const weatherSignal = store.getWeatherSignal(tripId);
      const initialData = {
        weather: weatherSignal
          ? {
              summary: weatherSignal.summary,
              riskHours: weatherSignal.riskHours,
            }
          : {
              summary: "No data yet",
              riskHours: [],
            },
      };
      reply.raw.write(`event: signal:update\ndata: ${JSON.stringify(initialData)}\n\n`);

      // Handle client disconnect
      request.raw.on("close", () => {
        sseHub.removeClient(tripId, reply.raw);
      });

      // Keep connection open - don't call reply.send()
    }
  );
}
