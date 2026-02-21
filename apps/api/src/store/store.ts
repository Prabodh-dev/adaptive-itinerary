/**
 * In-memory data store for trips, activities, and itineraries
 */
import { nanoid } from "nanoid";
import type {
  Trip,
  Activity,
  ActivityInput,
  Itinerary,
  ItineraryItem,
  CreateTripRequest,
  Suggestion,
  CrowdSignalItem,
  TransitAlert,
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

export interface WeatherSignalRecord {
  observedAt: string;
  summary: string;
  riskHours: string[];
  raw?: any;
}

export interface CrowdSignalRecord {
  observedAt: string;
  crowds: CrowdSignalItem[];
  raw?: any;
}

export interface TransitSignalRecord {
  observedAt: string;
  alerts: TransitAlert[];
  raw?: any;
}

// In-memory stores
const trips = new Map<string, TripRecord>();
const activities = new Map<string, ActivityRecord[]>();
const itineraries = new Map<string, ItineraryVersionRecord[]>();
const weatherSignals = new Map<string, WeatherSignalRecord>();
const crowdSignals = new Map<string, CrowdSignalRecord>();
const transitSignals = new Map<string, TransitSignalRecord>();
const suggestions = new Map<string, Suggestion[]>();

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

/**
 * Get all trip IDs (for worker polling)
 */
export function getTripIds(): string[] {
  return Array.from(trips.keys());
}

/**
 * Upsert weather signal for a trip
 */
export function upsertWeatherSignal(
  tripId: string,
  data: { observedAt: string; summary: string; riskHours: string[]; raw?: any }
): void {
  if (!trips.has(tripId)) {
    throw new Error(`Trip ${tripId} not found`);
  }

  weatherSignals.set(tripId, {
    observedAt: data.observedAt,
    summary: data.summary,
    riskHours: data.riskHours,
    raw: data.raw,
  });
}

/**
 * Get weather signal for a trip
 */
export function getWeatherSignal(tripId: string): WeatherSignalRecord | null {
  return weatherSignals.get(tripId) || null;
}

/**
 * Upsert crowd signals for a trip
 */
export function upsertCrowdSignals(
  tripId: string,
  data: { observedAt: string; crowds: CrowdSignalItem[]; raw?: any }
): void {
  if (!trips.has(tripId)) {
    throw new Error(`Trip ${tripId} not found`);
  }

  crowdSignals.set(tripId, {
    observedAt: data.observedAt,
    crowds: data.crowds,
    raw: data.raw,
  });
}

/**
 * Get crowd signals for a trip
 */
export function getCrowdSignals(tripId: string): CrowdSignalRecord | null {
  return crowdSignals.get(tripId) || null;
}

/**
 * Upsert transit signals for a trip
 */
export function upsertTransitSignals(
  tripId: string,
  data: { observedAt: string; alerts: TransitAlert[]; raw?: any }
): void {
  if (!trips.has(tripId)) {
    throw new Error(`Trip ${tripId} not found`);
  }

  transitSignals.set(tripId, {
    observedAt: data.observedAt,
    alerts: data.alerts,
    raw: data.raw,
  });
}

/**
 * Get transit signals for a trip
 */
export function getTransitSignals(tripId: string): TransitSignalRecord | null {
  return transitSignals.get(tripId) || null;
}

/**
 * Add a suggestion for a trip
 * Prevents duplicate suggestions based on kind and beforePlan items
 */
export function addSuggestion(tripId: string, suggestion: Suggestion): void {
  if (!trips.has(tripId)) {
    throw new Error(`Trip ${tripId} not found`);
  }

  const tripSuggestions = suggestions.get(tripId) || [];

  // Check for duplicate: same kind and same beforePlan items
  const isDuplicate = tripSuggestions.some((existing) => {
    if (existing.kind !== suggestion.kind) return false;
    if (existing.beforePlan.items.length !== suggestion.beforePlan.items.length) return false;
    
    const existingIds = existing.beforePlan.items.map((i: ItineraryItem) => i.activityId).join(",");
    const newIds = suggestion.beforePlan.items.map((i: ItineraryItem) => i.activityId).join(",");
    
    return existingIds === newIds;
  });

  if (isDuplicate) {
    console.log(`[Store] Skipping duplicate suggestion of kind: ${suggestion.kind}`);
    return;
  }

  tripSuggestions.push(suggestion);
  suggestions.set(tripId, tripSuggestions);
}

/**
 * List suggestions for a trip
 */
export function listSuggestions(
  tripId: string,
  _status?: string
): Suggestion[] {
  const tripSuggestions = suggestions.get(tripId) || [];
  // Phase 3: Only returning all suggestions, status filtering can be added later
  return tripSuggestions;
}

