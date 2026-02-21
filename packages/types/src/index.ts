// Export all Zod schemas
export {
  LatLngSchema,
  PlaceSchema,
  TripPreferencesSchema,
  CreateTripRequestSchema,
  CreateTripResponseSchema,
  TripSchema,
  ActivityInputSchema,
  ActivitySchema,
  AddActivitiesRequestSchema,
  AddActivitiesResponseSchema,
  ItineraryItemSchema,
  ItinerarySchema,
  GenerateItineraryRequestSchema,
  GenerateItineraryResponseSchema,
  GetTripResponseSchema,
} from "./schemas.js";

// Export all inferred TypeScript types
export type {
  LatLng,
  Place,
  TripPreferences,
  CreateTripRequest,
  CreateTripResponse,
  Trip,
  ActivityInput,
  Activity,
  AddActivitiesRequest,
  AddActivitiesResponse,
  ItineraryItem,
  Itinerary,
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  GetTripResponse,
} from "./schemas.js";

// Legacy types (for future phases)
export type Signals = {
  weather: { summary: string; riskHours: string[] };
  crowds: { placeId: string; busyNow: number; peakHours: string[] }[];
  transit: { alerts: { line: string; delayMin: number; message: string }[] };
};

export type Suggestion = {
  suggestionId: string;
  kind: "reorder" | "swap" | "shift";
  reasons: string[];
  benefit?: Record<string, number>;
  beforePlan: any;
  afterPlan: any;
};
