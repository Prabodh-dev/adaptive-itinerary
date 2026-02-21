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
  SuggestionStatus,
  SuggestionTrigger,
  CrowdSignalItem,
  TransitAlert,
  Weights,
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

// Default weights for a new trip
const DEFAULT_WEIGHTS: Weights = {
  weatherWeight: 1.0,
  crowdWeight: 1.0,
  transitWeight: 1.0,
  travelWeight: 1.0,
  changeAversion: 1.0,
};

// In-memory stores
const trips = new Map<string, TripRecord>();
const activities = new Map<string, ActivityRecord[]>();
const itineraries = new Map<string, ItineraryVersionRecord[]>();
const weatherSignals = new Map<string, WeatherSignalRecord>();
const crowdSignals = new Map<string, CrowdSignalRecord>();
const transitSignals = new Map<string, TransitSignalRecord>();
const suggestions = new Map<string, Suggestion[]>();
const weights = new Map<string, Weights>();
const suggestionCooldowns = new Map<string, number>(); // tripId -> last suggestion timestamp

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
  status?: string
): Suggestion[] {
  const tripSuggestions = suggestions.get(tripId) || [];
  if (status) {
    return tripSuggestions.filter((s) => s.status === status);
  }
  return tripSuggestions;
}

/**
 * Set suggestion status
 */
export function setSuggestionStatus(
  tripId: string,
  suggestionId: string,
  status: SuggestionStatus
): boolean {
  const tripSuggestions = suggestions.get(tripId) || [];
  const suggestion = tripSuggestions.find((s) => s.suggestionId === suggestionId);
  if (!suggestion) return false;
  
  suggestion.status = status;
  suggestions.set(tripId, tripSuggestions);
  return true;
}

/**
 * Get a suggestion by ID
 */
export function getSuggestion(
  tripId: string,
  suggestionId: string
): Suggestion | null {
  const tripSuggestions = suggestions.get(tripId) || [];
  return tripSuggestions.find((s) => s.suggestionId === suggestionId) || null;
}

/**
 * Get weights for a trip (creates defaults if missing)
 */
export function getWeights(tripId: string): Weights {
  let tripWeights = weights.get(tripId);
  if (!tripWeights) {
    tripWeights = { ...DEFAULT_WEIGHTS };
    weights.set(tripId, tripWeights);
  }
  return tripWeights;
}

/**
 * Update weights based on feedback
 */
export function updateWeights(
  tripId: string,
  { trigger, accepted }: { trigger: SuggestionTrigger; accepted: boolean }
): Weights {
  const tripWeights = getWeights(tripId);
  const delta = accepted ? 0.05 : -0.05;
  const aversionDelta = accepted ? -0.03 : 0.03;

  if (trigger === "weather") {
    tripWeights.weatherWeight = Math.max(0.5, Math.min(2.0, tripWeights.weatherWeight + delta));
  } else if (trigger === "crowds") {
    tripWeights.crowdWeight = Math.max(0.5, Math.min(2.0, tripWeights.crowdWeight + delta));
  } else if (trigger === "transit" || trigger === "traffic") {
    tripWeights.transitWeight = Math.max(0.5, Math.min(2.0, tripWeights.transitWeight + delta));
  }

  tripWeights.changeAversion = Math.max(0.5, Math.min(2.0, tripWeights.changeAversion + aversionDelta));

  weights.set(tripId, tripWeights);
  return tripWeights;
}

/**
 * Check if suggestion can be created (cooldown check)
 * Returns true if cooldown has passed (10 minutes)
 */
export function canCreateSuggestion(tripId: string): boolean {
  const lastSuggestionTime = suggestionCooldowns.get(tripId);
  if (!lastSuggestionTime) return true;
  
  const cooldownMs = 10 * 60 * 1000; // 10 minutes
  return Date.now() - lastSuggestionTime > cooldownMs;
}

/**
 * Update suggestion cooldown timestamp
 */
export function updateSuggestionCooldown(tripId: string): void {
  suggestionCooldowns.set(tripId, Date.now());
}

/**
 * Get last suggestion timestamp for a trip
 */
export function getLastSuggestionTime(tripId: string): number | null {
  return suggestionCooldowns.get(tripId) || null;
}

