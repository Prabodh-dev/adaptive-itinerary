/**
 * Fastify API Server
 */
import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerTripRoutes } from "./routes/trip.routes.js";
import { registerPlacesRoutes } from "./routes/places.routes.js";

const PORT = parseInt(process.env.PORT || "8080", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

async function start() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // Register CORS
  await app.register(cors, {
    origin: CORS_ORIGIN,
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
