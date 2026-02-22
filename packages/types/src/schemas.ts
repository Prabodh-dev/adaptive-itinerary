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
  radiusKm: z.number().positive().optional(),
  categories: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional(),
  interests: z.array(z.string()).optional(), // e.g. ["history", "art", "food", "nature"]
  avoid: z.array(z.string()).optional(),      // e.g. ["no-food", "no-nature"]
});

export const PlacesSearchResponseSchema = z.object({
  places: z.array(PlaceSchema),
});

// ===== Weather Signal Schemas =====

export const SignalWeatherSchema = z.object({
  summary: z.string(),
  riskHours: z.array(z.string()),
});

export const UpsertWeatherSignalRequestSchema = z.object({
  observedAt: z.string(),
  weather: z.object({
    summary: z.string(),
    riskHours: z.array(z.string()),
  }),
  raw: z.any().optional(),
});

// ===== Crowd Signal Schemas =====

export const CrowdSignalItemSchema = z.object({
  placeId: z.string(),
  placeName: z.string(),
  busyNow: z.number().min(0).max(100),
  peakHours: z.array(z.string()),
});

export const UpsertCrowdSignalRequestSchema = z.object({
  observedAt: z.string(),
  crowds: z.array(CrowdSignalItemSchema),
  raw: z.any().optional(),
});

// Transit signal schemas
export const TransitAlertSchema = z.object({
  line: z.string(),
  delayMin: z.number().min(0),
  message: z.string(),
});

export const TransitSignalSchema = z.object({
  alerts: z.array(TransitAlertSchema),
});

export const UpsertTransitSignalRequestSchema = z.object({
  observedAt: z.string(),
  transit: TransitSignalSchema,
  raw: z.any().optional(),
});

export const SignalsResponseSchema = z.object({
  weather: SignalWeatherSchema,
  crowds: z.array(CrowdSignalItemSchema).optional(),
  transit: TransitSignalSchema.optional(),
  community: z
    .object({
      reports: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          severity: z.number().int().min(1).max(5),
          message: z.string(),
          lat: z.number(),
          lng: z.number(),
          photoUrl: z.string().optional(),
          expiresAt: z.string(),
          createdAt: z.string(),
        })
      ),
    })
    .optional(),
});

// ===== Suggestion Schemas =====

export const SuggestionStatusSchema = z.enum(["pending", "accepted", "rejected", "applied"]);
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;

export const SuggestionKindSchema = z.enum(["reorder", "swap", "shift"]);
export type SuggestionKind = z.infer<typeof SuggestionKindSchema>;

export const SuggestionTriggerSchema = z.enum(["weather", "crowds", "transit", "traffic", "mixed"]);
export type SuggestionTrigger = z.infer<typeof SuggestionTriggerSchema>;

export const SuggestionDiffSchema = z.object({
  moved: z.array(z.object({
    placeName: z.string(),
    from: z.string(),
    to: z.string(),
  })),
  swapped: z.array(z.object({
    fromPlace: z.string(),
    toPlace: z.string(),
  })),
  summary: z.string(),
});
export type SuggestionDiff = z.infer<typeof SuggestionDiffSchema>;

export const SuggestionImpactSchema = z.object({
  travelSavedMin: z.number().optional(),
  weatherRiskReduced: z.number().optional(),
  crowdReduced: z.number().optional(),
  delayAvoidedMin: z.number().optional(),
});
export type SuggestionImpact = z.infer<typeof SuggestionImpactSchema>;

export const SuggestionPlanSchema = z.object({
  version: z.number(),
  items: z.array(ItineraryItemSchema),
});
export type SuggestionPlan = z.infer<typeof SuggestionPlanSchema>;

export const SuggestionSchema = z.object({
  suggestionId: z.string(),
  kind: SuggestionKindSchema,
  status: SuggestionStatusSchema.default("pending"),
  createdAt: z.string(),
  trigger: SuggestionTriggerSchema.default("mixed"),
  reasons: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  impact: SuggestionImpactSchema.optional(),
  beforePlan: SuggestionPlanSchema,
  afterPlan: SuggestionPlanSchema,
  diff: SuggestionDiffSchema.optional(),
});

export const ListSuggestionsResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema),
});

// ===== Feedback Schemas =====

export const FeedbackRequestSchema = z.object({
  suggestionId: z.string(),
  action: z.enum(["accept", "reject"]),
  meta: z.record(z.any()).optional(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

export const WeightsSchema = z.object({
  weatherWeight: z.number(),
  crowdWeight: z.number(),
  transitWeight: z.number(),
  travelWeight: z.number(),
  changeAversion: z.number(),
});
export type Weights = z.infer<typeof WeightsSchema>;

export const FeedbackResponseSchema = z.object({
  ok: z.literal(true),
  weights: WeightsSchema,
});
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;

// ===== Apply Suggestion Response =====

export const ApplySuggestionResponseSchema = z.object({
  version: z.number(),
  itinerary: ItinerarySchema,
});
export type ApplySuggestionResponse = z.infer<typeof ApplySuggestionResponseSchema>;

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
export type UpsertWeatherSignalRequest = z.infer<typeof UpsertWeatherSignalRequestSchema>;
export type CrowdSignalItem = z.infer<typeof CrowdSignalItemSchema>;
export type UpsertCrowdSignalRequest = z.infer<typeof UpsertCrowdSignalRequestSchema>;
export type TransitAlert = z.infer<typeof TransitAlertSchema>;
export type TransitSignal = z.infer<typeof TransitSignalSchema>;
export type UpsertTransitSignalRequest = z.infer<typeof UpsertTransitSignalRequestSchema>;
export type SignalsResponse = z.infer<typeof SignalsResponseSchema>;
export type CommunitySignalReport = NonNullable<SignalsResponse["community"]>["reports"][number];
export type CommunitySignals = NonNullable<SignalsResponse["community"]>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type ListSuggestionsResponse = z.infer<typeof ListSuggestionsResponseSchema>;

