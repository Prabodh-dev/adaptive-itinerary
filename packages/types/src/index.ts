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
  PlacesSearchRequestSchema,
  PlacesSearchResponseSchema,
  SignalWeatherSchema,
  CrowdSignalItemSchema,
  UpsertCrowdSignalRequestSchema,
  TransitAlertSchema,
  TransitSignalSchema,
  UpsertTransitSignalRequestSchema,
  SignalsResponseSchema,
  UpsertWeatherSignalRequestSchema,
  SuggestionSchema,
  ListSuggestionsResponseSchema,
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
  PlacesSearchRequest,
  PlacesSearchResponse,
  SignalWeather,
  CrowdSignalItem,
  UpsertCrowdSignalRequest,
  TransitAlert,
  TransitSignal,
  UpsertTransitSignalRequest,
  SignalsResponse,
  UpsertWeatherSignalRequest,
  Suggestion,
  ListSuggestionsResponse,
} from "./schemas.js";

// Legacy types (for future phases)
export type Signals = {
  weather: { summary: string; riskHours: string[] };
  crowds: { placeId: string; busyNow: number; peakHours: string[] }[];
  transit: { alerts: { line: string; delayMin: number; message: string }[] };
};

