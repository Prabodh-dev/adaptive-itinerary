/**
 * Planner service for generating itineraries
 */
import type { Itinerary, ItineraryItem, LatLng } from "@adaptive/types";
import type { TripRecord, ActivityRecord } from "../store/store.js";
import { parseHHMM, formatHHMM } from "../utils/time.js";
import { haversineKm, estimateTravelMin } from "../utils/geo.js";

export interface GenerateItineraryParams {
  trip: TripRecord;
  activities: ActivityRecord[];
  mode: "driving" | "walking" | "transit";
  startLocation?: LatLng;
}

/**
 * Generate an itinerary for a trip based on activities
 * Phase 1: Sequential scheduling with basic travel time estimation
 */
export function generateItinerary(
  params: GenerateItineraryParams
): Itinerary {
  const { trip, activities, mode, startLocation } = params;

  if (activities.length === 0) {
    return { items: [], totalTravelMin: 0 };
  }

  const tripStartMin = parseHHMM(trip.startTime);
  const tripEndMin = parseHHMM(trip.endTime);
  
  const items: ItineraryItem[] = [];
  let totalTravelMin = 0;
  let currentTimeMin = tripStartMin;
  let prevLocation: LatLng | null = startLocation || null;

  for (const activity of activities) {
    const currentLocation: LatLng = {
      lat: activity.place.lat,
      lng: activity.place.lng,
    };

    // Calculate travel time from previous location
    let travelFromPrevMin = 0;
    if (prevLocation) {
      const distanceKm = haversineKm(
        prevLocation.lat,
        prevLocation.lng,
        currentLocation.lat,
        currentLocation.lng
      );
      travelFromPrevMin = estimateTravelMin(distanceKm, mode);
      totalTravelMin += travelFromPrevMin;
    }

    // Schedule this activity
    const startTime = currentTimeMin + travelFromPrevMin;
    const endTime = startTime + activity.durationMin;

    // Check if we exceed the trip end time (Phase 1: allow overflow, log warning)
    if (endTime > tripEndMin) {
      console.warn(
        `Activity ${activity.activityId} (${activity.place.name}) ends at ${formatHHMM(endTime)}, ` +
        `which exceeds trip end time ${trip.endTime}. This will be handled in future phases.`
      );
    }

    items.push({
      activityId: activity.activityId,
      placeName: activity.place.name,
      startTime: formatHHMM(startTime),
      endTime: formatHHMM(endTime),
      travelFromPrevMin,
    });

    // Update for next iteration
    currentTimeMin = endTime;
    prevLocation = currentLocation;
  }

  return {
    items,
    totalTravelMin,
  };
}
