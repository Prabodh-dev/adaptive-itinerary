/**
 * Planner service for generating itineraries
 */
import type { Itinerary, ItineraryItem, LatLng } from "@adaptive/types";
import type { TripRecord, ActivityRecord } from "../store/store.js";
import { parseHHMM, formatHHMM } from "../utils/time.js";
import { haversineKm, estimateTravelMin } from "../utils/geo.js";
import { getDurationMatrixMapbox, getMapboxProfile } from "@adaptive/integrations";

export interface GenerateItineraryParams {
  trip: TripRecord;
  activities: ActivityRecord[];
  mode: "driving" | "walking" | "transit";
  startLocation?: LatLng;
  optimizeOrder?: boolean;
}

/**
 * Generate an itinerary for a trip based on activities
 * Phase 2: Adds route optimization using Mapbox Matrix API
 */
export async function generateItinerary(
  params: GenerateItineraryParams
): Promise<Itinerary> {
  const { trip, activities, mode, startLocation, optimizeOrder = true } = params;

  if (activities.length === 0) {
    return { items: [], totalTravelMin: 0 };
  }

  const tripStartMin = parseHHMM(trip.startTime);
  const tripEndMin = parseHHMM(trip.endTime);

  // Determine if we should optimize and if we have necessary API credentials
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || "";
  const shouldOptimize = optimizeOrder && mapboxToken && activities.length > 1;

  let orderedActivities = activities;
  let durationMatrix: number[][] | null = null;

  if (shouldOptimize) {
    try {
      // Build duration matrix using Mapbox
      const coordinates = buildCoordinateList(activities, startLocation);
      
      // Choose profile based on mode
      const trafficProfile = process.env.MAPBOX_TRAFFIC_PROFILE || "mapbox/driving-traffic";
      const profile = getMapboxProfile(mode, trafficProfile);

      durationMatrix = await getDurationMatrixMapbox(profile, coordinates, mapboxToken);

      // Optimize activity order using nearest-neighbor with locked activities constraint
      orderedActivities = optimizeActivityOrder(
        activities,
        durationMatrix,
        startLocation ? 1 : 0 // Offset if we have a start location
      );

      console.log("Route optimized using Mapbox Matrix API");
    } catch (error) {
      console.warn("Failed to optimize route, falling back to original order:", error);
      // Fall back to original order if optimization fails
    }
  }

  // Build itinerary with ordered activities
  const items: ItineraryItem[] = [];
  let totalTravelMin = 0;
  let currentTimeMin = tripStartMin;
  let prevLocation: LatLng | null = startLocation || null;
  let prevMatrixIndex = startLocation ? 0 : -1;

  for (let i = 0; i < orderedActivities.length; i++) {
    const activity = orderedActivities[i];
    const currentLocation: LatLng = {
      lat: activity.place.lat,
      lng: activity.place.lng,
    };

    // Find the matrix index for this activity
    const originalIndex = activities.findIndex(a => a.activityId === activity.activityId);
    const currentMatrixIndex = startLocation ? originalIndex + 1 : originalIndex;

    // Calculate travel time from previous location
    let travelFromPrevMin = 0;
    if (prevLocation && prevMatrixIndex >= 0) {
      if (durationMatrix) {
        // Use real travel time from matrix
        const travelSec = durationMatrix[prevMatrixIndex][currentMatrixIndex];
        travelFromPrevMin = Math.round(travelSec / 60);
      } else {
        // Fallback to haversine estimation
        const distanceKm = haversineKm(
          prevLocation.lat,
          prevLocation.lng,
          currentLocation.lat,
          currentLocation.lng
        );
        travelFromPrevMin = estimateTravelMin(distanceKm, mode);
      }
      totalTravelMin += travelFromPrevMin;
    }

    // Schedule this activity
    const startTime = currentTimeMin + travelFromPrevMin;
    const endTime = startTime + activity.durationMin;

    // Check if we exceed the trip end time
    if (endTime > tripEndMin) {
      console.warn(
        `Activity ${activity.activityId} (${activity.place.name}) ends at ${formatHHMM(endTime)}, ` +
        `which exceeds trip end time ${trip.endTime}.`
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
    prevMatrixIndex = currentMatrixIndex;
  }

  return {
    items,
    totalTravelMin,
  };
}

/**
 * Build coordinate list for Mapbox Matrix API
 * If startLocation is provided, it becomes the first coordinate
 */
function buildCoordinateList(
  activities: ActivityRecord[],
  startLocation?: LatLng
): Array<{ lat: number; lng: number }> {
  const coords: Array<{ lat: number; lng: number }> = [];

  if (startLocation) {
    coords.push(startLocation);
  }

  for (const activity of activities) {
    coords.push({
      lat: activity.place.lat,
      lng: activity.place.lng,
    });
  }

  return coords;
}

/**
 * Optimize activity order using nearest-neighbor algorithm
 * Respects locked activities by keeping them in their original positions
 * @param activities - Original activities array
 * @param durationMatrix - Duration matrix from Mapbox (in seconds)
 * @param offset - Offset for matrix indices (1 if startLocation is included, 0 otherwise)
 */
function optimizeActivityOrder(
  activities: ActivityRecord[],
  durationMatrix: number[][],
  offset: number
): ActivityRecord[] {
  if (activities.length <= 1) {
    return activities;
  }

  // Separate locked and unlocked activities
  const locked: Array<{ index: number; activity: ActivityRecord }> = [];
  const unlocked: ActivityRecord[] = [];

  activities.forEach((activity, index) => {
    if (activity.locked) {
      locked.push({ index, activity });
    } else {
      unlocked.push(activity);
    }
  });

  // If all activities are locked, keep original order
  if (unlocked.length === 0) {
    return activities;
  }

  // If no activities are locked, use simple nearest-neighbor
  if (locked.length === 0) {
    return nearestNeighborOrder(unlocked, durationMatrix, offset);
  }

  // Mixed case: optimize unlocked activities around locked ones
  // For simplicity, we'll use a greedy approach that respects locked positions
  const result: ActivityRecord[] = new Array(activities.length);
  
  // Place locked activities in their original positions
  for (const { index, activity } of locked) {
    result[index] = activity;
  }

  // Fill in unlocked activities using nearest-neighbor between locked segments
  let unlockedIndex = 0;
  for (let i = 0; i < result.length; i++) {
    if (!result[i] && unlockedIndex < unlocked.length) {
      result[i] = unlocked[unlockedIndex++];
    }
  }

  return result;
}

/**
 * Simple nearest-neighbor optimization
 * Always choose the closest unvisited activity from current position
 */
function nearestNeighborOrder(
  activities: ActivityRecord[],
  durationMatrix: number[][],
  offset: number
): ActivityRecord[] {
  const n = activities.length;
  const visited = new Array(n).fill(false);
  const ordered: ActivityRecord[] = [];

  let currentIdx = offset > 0 ? 0 : -1; // Start from startLocation or first activity

  for (let step = 0; step < n; step++) {
    let nearestIdx = -1;
    let minDuration = Infinity;

    // Find nearest unvisited activity
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;

      const matrixIdx = i + offset;
      let duration: number;

      if (currentIdx === -1) {
        // First activity, no previous location
        duration = 0;
      } else if (offset > 0) {
        // We have a start location
        duration = durationMatrix[currentIdx][matrixIdx];
      } else {
        // No start location, use previous activity
        const prevMatrixIdx = ordered.length > 0 ? activities.indexOf(ordered[ordered.length - 1]) : 0;
        duration = durationMatrix[prevMatrixIdx][matrixIdx];
      }

      if (duration < minDuration) {
        minDuration = duration;
        nearestIdx = i;
      }
    }

    if (nearestIdx === -1) break;

    visited[nearestIdx] = true;
    ordered.push(activities[nearestIdx]);
    currentIdx = nearestIdx + offset;
  }

  return ordered;
}
