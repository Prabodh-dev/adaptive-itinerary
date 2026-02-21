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
  place: { name: string; lat: number; lng: number };
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

export interface GetTripResponse {
  trip: Record<string, unknown>;
  activities: ActivityInput[];
  itinerary: Itinerary | null;
}

export async function createTrip(data: CreateTripRequest): Promise<CreateTripResponse> {
  return request<CreateTripResponse>("/trip", { method: "POST", body: JSON.stringify(data) });
}

export async function addActivities(tripId: string, activities: ActivityInput[]): Promise<void> {
  await request(`/trip/${tripId}/activities`, { method: "POST", body: JSON.stringify({ activities }) });
}

export async function generateItinerary(tripId: string): Promise<GenerateItineraryResponse> {
  return request<GenerateItineraryResponse>(`/trip/${tripId}/itinerary/generate`, { method: "POST" });
}

export async function getTrip(tripId: string): Promise<GetTripResponse> {
  return request<GetTripResponse>(`/trip/${tripId}`);
}
