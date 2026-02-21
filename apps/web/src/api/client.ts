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
