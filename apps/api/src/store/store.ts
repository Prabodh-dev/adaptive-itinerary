/**
 * In-memory data store for trips, activities, and itineraries
 */
import { nanoid } from "nanoid";
import type {
  Trip,
  Activity,
  ActivityInput,
  Itinerary,
  CreateTripRequest,
} from "@adaptive/types";

// Internal record types
export interface TripRecord extends Trip {
  tripId: string;
  createdAt: string;
}

export interface ActivityRecord extends Activity {
  activityId: string;
  addedAt: string;
}

export interface ItineraryVersionRecord {
  version: number;
  itinerary: Itinerary;
  generatedAt: string;
}

// In-memory stores
const trips = new Map<string, TripRecord>();
const activities = new Map<string, ActivityRecord[]>();
const itineraries = new Map<string, ItineraryVersionRecord[]>();

/**
 * Create a new trip
 */
export function createTrip(data: CreateTripRequest): {
  tripId: string;
  trip: TripRecord;
} {
  const tripId = `trp_${nanoid(12)}`;
  const trip: TripRecord = {
    tripId,
    city: data.city,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    preferences: data.preferences,
    createdAt: new Date().toISOString(),
  };

  trips.set(tripId, trip);
  activities.set(tripId, []);
  itineraries.set(tripId, []);

  return { tripId, trip };
}

/**
 * Get trip by ID
 */
export function getTrip(tripId: string): {
  trip: TripRecord;
  activities: ActivityRecord[];
  latestItinerary?: {
    version: number;
    itinerary: Itinerary;
    generatedAt: string;
  };
} | null {
  const trip = trips.get(tripId);
  if (!trip) return null;

  const tripActivities = activities.get(tripId) || [];
  const tripItineraries = itineraries.get(tripId) || [];
  const latestItinerary =
    tripItineraries.length > 0
      ? tripItineraries[tripItineraries.length - 1]
      : undefined;

  return {
    trip,
    activities: tripActivities,
    latestItinerary,
  };
}

/**
 * Upsert activities for a trip (replaces all existing activities)
 */
export function upsertActivities(
  tripId: string,
  newActivities: ActivityInput[]
): number {
  if (!trips.has(tripId)) {
    throw new Error(`Trip ${tripId} not found`);
  }

  const activityRecords: ActivityRecord[] = newActivities.map((input) => ({
    activityId: `act_${nanoid(12)}`,
    place: input.place,
    durationMin: input.durationMin,
    locked: input.locked,
    addedAt: new Date().toISOString(),
  }));

  activities.set(tripId, activityRecords);
  return activityRecords.length;
}

/**
 * Add a new itinerary version for a trip
 */
export function addItineraryVersion(
  tripId: string,
  itinerary: Itinerary
): number {
  if (!trips.has(tripId)) {
    throw new Error(`Trip ${tripId} not found`);
  }

  const tripItineraries = itineraries.get(tripId) || [];
  const version = tripItineraries.length + 1;

  const record: ItineraryVersionRecord = {
    version,
    itinerary,
    generatedAt: new Date().toISOString(),
  };

  tripItineraries.push(record);
  itineraries.set(tripId, tripItineraries);

  return version;
}

/**
 * Get latest itinerary for a trip
 */
export function getLatestItinerary(
  tripId: string
): ItineraryVersionRecord | null {
  const tripItineraries = itineraries.get(tripId);
  if (!tripItineraries || tripItineraries.length === 0) return null;
  return tripItineraries[tripItineraries.length - 1];
}

/**
 * Get activities for a trip
 */
export function getActivities(tripId: string): ActivityRecord[] {
  return activities.get(tripId) || [];
}
