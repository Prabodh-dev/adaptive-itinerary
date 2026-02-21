const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface CreateTripRequest {
  city: string;
  date: string;
  startTime: string;
  endTime: string;
  preferences: Record<string, unknown>;
}

export interface CreateTripResponse {
  tripId: string;
}

export interface ActivityInput {
  place: {
    provider: string;
    providerPlaceId: string;
    name: string;
    lat: number;
    lng: number;
    category?: string;
    isIndoor?: boolean;
    address?: string;
  };
  durationMin: number;
  locked: boolean;
}

export interface ItineraryItem {
  activityId: string;
  placeName: string;
  startTime: string;
  endTime: string;
  travelFromPrevMin: number;
}

export interface Itinerary {
  items: ItineraryItem[];
  totalTravelMin: number;
}

export interface GenerateItineraryResponse {
  version: number;
  itinerary: Itinerary;
}

export interface PlaceSearchResult {
  provider: string;
  providerPlaceId: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  isIndoor?: boolean;
  address?: string;
}

export interface PlaceSearchRequest {
  query: string;
  near: { lat: number; lng: number };
  radiusKm?: number;
  limit?: number;
}

export interface PlaceSearchResponse {
  places: PlaceSearchResult[];
}

export interface GetTripResponse {
  trip: Record<string, unknown>;
  activities: ActivityInput[];
  latestItinerary?: {
    version: number;
    itinerary: Itinerary;
    generatedAt: string;
  };
}

export async function createTrip(data: CreateTripRequest): Promise<CreateTripResponse> {
  return request<CreateTripResponse>("/trip", { method: "POST", body: JSON.stringify(data) });
}

export async function addActivities(tripId: string, activities: ActivityInput[]): Promise<void> {
  await request(`/trip/${tripId}/activities`, { method: "POST", body: JSON.stringify({ activities }) });
}

export async function generateItinerary(tripId: string, mode: "driving" | "walking" | "transit"): Promise<GenerateItineraryResponse> {
  return request<GenerateItineraryResponse>(`/trip/${tripId}/itinerary/generate`, { method: "POST", body: JSON.stringify({ mode }) });
}

export async function getTrip(tripId: string): Promise<GetTripResponse> {
  return request<GetTripResponse>(`/trip/${tripId}`);
}

export async function searchPlaces(
  query: string,
  near: { lat: number; lng: number },
  radiusKm: number = 5,
  limit: number = 10
): Promise<PlaceSearchResponse> {
  return request<PlaceSearchResponse>("/places/search", {
    method: "POST",
    body: JSON.stringify({ query, near, radiusKm, limit }),
  });
}

// ===== Phase 3: Signals & Suggestions =====

export interface SignalWeather {
  summary: string;
  riskHours: string[];
}

export interface CrowdSignalItem {
  placeId: string;
  placeName: string;
  busyNow: number;
  peakHours: string[];
}

export interface SignalsResponse {
  weather: SignalWeather;
  crowds: CrowdSignalItem[];
  transit?: {
    alerts: Array<{
      line: string;
      delayMin: number;
      message: string;
    }>;
  };
}

export interface Suggestion {
  suggestionId: string;
  kind: "reorder" | "swap" | "shift";
  status: "pending" | "accepted" | "rejected" | "applied";
  trigger: "weather" | "crowds" | "transit" | "traffic" | "mixed";
  createdAt: string;
  reasons: string[];
  confidence: number;
  impact?: {
    travelSavedMin?: number;
    weatherRiskReduced?: number;
    crowdReduced?: number;
    delayAvoidedMin?: number;
  };
  beforePlan: {
    version: number;
    items: ItineraryItem[];
  };
  afterPlan: {
    version: number;
    items: ItineraryItem[];
  };
  diff?: {
    moved: Array<{ placeName: string; from: string; to: string }>;
    swapped: Array<{ fromPlace: string; toPlace: string }>;
    summary: string;
  };
}

export interface ListSuggestionsResponse {
  suggestions: Suggestion[];
}

export interface FeedbackRequest {
  suggestionId: string;
  action: "accept" | "reject";
  meta?: Record<string, unknown>;
}

export interface Weights {
  weatherWeight: number;
  crowdWeight: number;
  transitWeight: number;
  travelWeight: number;
  changeAversion: number;
}

export interface FeedbackResponse {
  ok: true;
  weights: Weights;
}

export interface ApplySuggestionResponse {
  version: number;
  itinerary: Itinerary;
}

export async function getSignals(tripId: string): Promise<SignalsResponse> {
  return request<SignalsResponse>(`/trip/${tripId}/signals`);
}

export async function getSuggestions(tripId: string, status?: string): Promise<ListSuggestionsResponse> {
  const query = status ? `?status=${status}` : "";
  return request<ListSuggestionsResponse>(`/trip/${tripId}/suggestions${query}`);
}

export async function applySuggestion(tripId: string, suggestionId: string): Promise<ApplySuggestionResponse> {
  return request<ApplySuggestionResponse>(`/trip/${tripId}/suggestions/${suggestionId}/apply`, {
    method: "POST",
  });
}

export async function sendFeedback(tripId: string, suggestionId: string, action: "accept" | "reject", meta?: Record<string, unknown>): Promise<FeedbackResponse> {
  return request<FeedbackResponse>(`/trip/${tripId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ suggestionId, action, meta }),
  });
}
