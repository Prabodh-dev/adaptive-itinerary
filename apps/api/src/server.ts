/**
 * Fastify API Server
 */
import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerTripRoutes } from "./routes/trip.routes.js";
import { registerPlacesRoutes } from "./routes/places.routes.js";
import { registerSignalsRoutes } from "./routes/signals.routes.js";
import { registerSuggestionsRoutes } from "./routes/suggestions.routes.js";
import { registerStreamRoutes } from "./routes/stream.routes.js";

const PORT = parseInt(process.env.PORT || "8080", 10);

async function start() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // Register CORS - allow all origins for development
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Health check endpoint
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Register trip routes
  await registerTripRoutes(app);

  // Register places routes
  await registerPlacesRoutes(app);

  // Register signals routes (Phase 3 - Weather)
  await registerSignalsRoutes(app);

  // Register suggestions routes (Phase 3 - Weather)
  await registerSuggestionsRoutes(app);

  // Register stream routes (Phase 3 - SSE)
  await registerStreamRoutes(app);

  // Start server
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`API server listening on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
