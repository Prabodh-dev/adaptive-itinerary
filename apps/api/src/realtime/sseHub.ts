/**
 * Server-Sent Events (SSE) Hub for real-time updates
 */
import type { ServerResponse } from "http";

// Map of tripId -> Set of response streams
const clients = new Map<string, Set<ServerResponse>>();

/**
 * Add a client to receive SSE updates for a trip
 */
export function addClient(tripId: string, res: ServerResponse): void {
  if (!clients.has(tripId)) {
    clients.set(tripId, new Set());
  }
  clients.get(tripId)!.add(res);
  console.log(`[SSE] Client connected for trip ${tripId}. Total clients: ${clients.get(tripId)!.size}`);
}

/**
 * Remove a client from receiving SSE updates for a trip
 */
export function removeClient(tripId: string, res: ServerResponse): void {
  const tripClients = clients.get(tripId);
  if (tripClients) {
    tripClients.delete(res);
    console.log(`[SSE] Client disconnected from trip ${tripId}. Remaining clients: ${tripClients.size}`);
    
    if (tripClients.size === 0) {
      clients.delete(tripId);
      console.log(`[SSE] No more clients for trip ${tripId}, cleaning up`);
    }
  }
}

/**
 * Emit an SSE event to all clients connected to a trip
 */
export function emit(tripId: string, eventName: string, payload: any): void {
  const tripClients = clients.get(tripId);
  if (!tripClients || tripClients.size === 0) {
    console.log(`[SSE] No clients connected for trip ${tripId}, skipping emit`);
    return;
  }

  const data = JSON.stringify(payload);
  const message = `event: ${eventName}\ndata: ${data}\n\n`;

  console.log(`[SSE] Emitting ${eventName} to ${tripClients.size} client(s) for trip ${tripId}`);

  for (const res of tripClients) {
    try {
      res.write(message);
    } catch (error) {
      console.error(`[SSE] Error writing to client:`, error);
      // Remove client if write fails
      removeClient(tripId, res);
    }
  }
}
