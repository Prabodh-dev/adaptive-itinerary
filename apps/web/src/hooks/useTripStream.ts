"use client";

import { useEffect, useRef, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

interface UseTripStreamOptions {
  tripId: string;
  onSignalUpdate?: (data: unknown) => void;
  onSuggestionNew?: (data: unknown) => void;
  onItineraryVersion?: (data: unknown) => void;
}

export function useTripStream({
  tripId,
  onSignalUpdate,
  onSuggestionNew,
  onItineraryVersion,
}: UseTripStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_BASE}/trip/${tripId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("signal:update", (event) => {
      try {
        const data = JSON.parse(event.data);
        onSignalUpdate?.(data);
      } catch (err) {
        console.error("Failed to parse signal:update event:", err);
      }
    });

    eventSource.addEventListener("suggestion:new", (event) => {
      try {
        const data = JSON.parse(event.data);
        onSuggestionNew?.(data);
      } catch (err) {
        console.error("Failed to parse suggestion:new event:", err);
      }
    });

    eventSource.addEventListener("itinerary:version", (event) => {
      try {
        const data = JSON.parse(event.data);
        onItineraryVersion?.(data);
      } catch (err) {
        console.error("Failed to parse itinerary:version event:", err);
      }
    });

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      eventSource.close();
    };
  }, [tripId, onSignalUpdate, onSuggestionNew, onItineraryVersion]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return {
    reconnect: connect,
  };
}
