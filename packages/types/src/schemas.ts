import { z } from "zod";

// ===== Base Schemas =====

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const PlaceSchema = z.object({
  provider: z.string(),
  providerPlaceId: z.string(),
  name: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.string().optional(),
  isIndoor: z.boolean().optional(),
  address: z.string().optional(),
});

// ===== Trip Schemas =====

export const TripPreferencesSchema = z.object({
  pace: z.enum(["slow", "medium", "fast"]),
  interests: z.array(z.string()),
  avoid: z.array(z.string()),
  budget: z.enum(["low", "medium", "high"]),
});

export const CreateTripRequestSchema = z.object({
  city: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  preferences: TripPreferencesSchema,
});

export const CreateTripResponseSchema = z.object({
  tripId: z.string(),
});

export const TripSchema = z.object({
  tripId: z.string(),
  city: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  preferences: TripPreferencesSchema,
  createdAt: z.string(),
});

// ===== Activity Schemas =====

export const ActivityInputSchema = z.object({
  place: PlaceSchema,
  durationMin: z.number().min(1),
  locked: z.boolean(),
});

export const ActivitySchema = z.object({
  activityId: z.string(),
  place: PlaceSchema,
  durationMin: z.number(),
  locked: z.boolean(),
  addedAt: z.string(),
});

export const AddActivitiesRequestSchema = z.object({
  activities: z.array(ActivityInputSchema).min(1),
});

export const AddActivitiesResponseSchema = z.object({
  ok: z.boolean(),
  count: z.number(),
});

// ===== Itinerary Schemas =====

export const ItineraryItemSchema = z.object({
  activityId: z.string(),
  placeName: z.string(),
  startTime: z.string(), // HH:mm
  endTime: z.string(), // HH:mm
  travelFromPrevMin: z.number(),
});

export const ItinerarySchema = z.object({
  items: z.array(ItineraryItemSchema),
  totalTravelMin: z.number(),
});

export const GenerateItineraryRequestSchema = z.object({
  mode: z.enum(["driving", "walking", "transit"]), // Required - no default
  startLocation: LatLngSchema.optional(),
  optimizeOrder: z.boolean().default(true), // Keep this default - optimization is recommended
});

export const GenerateItineraryResponseSchema = z.object({
  version: z.number(),
  itinerary: ItinerarySchema,
});

// ===== Get Trip Response =====

export const GetTripResponseSchema = z.object({
  trip: TripSchema,
  activities: z.array(ActivitySchema),
  latestItinerary: z
    .object({
      version: z.number(),
      itinerary: ItinerarySchema,
      generatedAt: z.string(),
    })
    .optional(),
});

// ===== Places Search Schemas =====

export const PlacesSearchRequestSchema = z.object({
  query: z.string().min(1),
  near: LatLngSchema,
  radiusKm: z.number().positive().optional(), // Optional - let API or client decide
  categories: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional(), // Optional - let API or client decide
});

export const PlacesSearchResponseSchema = z.object({
  places: z.array(PlaceSchema),
});

// ===== Weather Signal Schemas =====

export const SignalWeatherSchema = z.object({
  summary: z.string(),
  riskHours: z.array(z.string()),
});

export const SignalsResponseSchema = z.object({
  weather: SignalWeatherSchema,
});

export const UpsertWeatherSignalRequestSchema = z.object({
  observedAt: z.string(),
  weather: z.object({
    summary: z.string(),
    riskHours: z.array(z.string()),
  }),
  raw: z.any().optional(),
});

// ===== Suggestion Schemas =====

export const SuggestionSchema = z.object({
  suggestionId: z.string(),
  kind: z.enum(["reorder", "swap", "shift"]),
  reasons: z.array(z.string()),
  benefit: z.record(z.number()).optional(),
  beforePlan: z.any(),
  afterPlan: z.any(),
});

export const ListSuggestionsResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema),
});

// ===== Inferred TypeScript Types =====

export type LatLng = z.infer<typeof LatLngSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type TripPreferences = z.infer<typeof TripPreferencesSchema>;
export type CreateTripRequest = z.infer<typeof CreateTripRequestSchema>;
export type CreateTripResponse = z.infer<typeof CreateTripResponseSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type ActivityInput = z.infer<typeof ActivityInputSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type AddActivitiesRequest = z.infer<typeof AddActivitiesRequestSchema>;
export type AddActivitiesResponse = z.infer<typeof AddActivitiesResponseSchema>;
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
export type GenerateItineraryRequest = z.infer<typeof GenerateItineraryRequestSchema>;
export type GenerateItineraryResponse = z.infer<typeof GenerateItineraryResponseSchema>;
export type GetTripResponse = z.infer<typeof GetTripResponseSchema>;
export type PlacesSearchRequest = z.infer<typeof PlacesSearchRequestSchema>;
export type PlacesSearchResponse = z.infer<typeof PlacesSearchResponseSchema>;
export type SignalWeather = z.infer<typeof SignalWeatherSchema>;
export type SignalsResponse = z.infer<typeof SignalsResponseSchema>;
export type UpsertWeatherSignalRequest = z.infer<typeof UpsertWeatherSignalRequestSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type ListSuggestionsResponse = z.infer<typeof ListSuggestionsResponseSchema>;

