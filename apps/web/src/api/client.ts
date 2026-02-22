const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const fetchOptions: RequestInit = { ...options };
  
  // Only set Content-Type if there's a body
  if (options?.body) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Content-Type": "application/json",
    };
  }
  
  const res = await fetch(`${API_BASE}${path}`, fetchOptions);
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
  interests?: string[];
  avoid?: string[];
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
  limit: number = 10,
  interests: string[] = [],
  avoid: string[] = []
): Promise<PlaceSearchResponse> {
  return request<PlaceSearchResponse>("/places/search", {
    method: "POST",
    body: JSON.stringify({ query, near, radiusKm, limit, interests, avoid }),
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
  community?: {
    reports: Array<{
      id: string;
      type: string;
      severity: number;
      message: string;
      lat: number;
      lng: number;
      photoUrl?: string;
      expiresAt: string;
      createdAt: string;
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

// ===== Phase 7: Contributor + Admin =====

export interface ContributorProfile {
  id: string;
  name: string;
  contact?: string | null;
  trustScore: number;
  approvedCount: number;
  rejectedCount: number;
  isBanned: boolean;
  createdAt: string;
}

export interface RegisterContributorResponse {
  contributorId: string;
  profile: ContributorProfile;
}

export async function registerContributor(
  contributorId: string,
  name: string,
  contact?: string
): Promise<RegisterContributorResponse> {
  return request<RegisterContributorResponse>("/contributor/register", {
    method: "POST",
    body: JSON.stringify({ contributorId, name, contact }),
  });
}

export interface SubmitContributorReportInput {
  contributorId: string;
  type: "weather" | "traffic" | "transit" | "crowds" | "closure";
  severity: number;
  message: string;
  lat: number;
  lng: number;
  locationText?: string;
  ttlMin?: number;
  photo?: File;
}

export interface SubmitContributorReportResponse {
  reportId: string;
  status: "pending";
}

export async function submitContributorReport(
  input: SubmitContributorReportInput
): Promise<SubmitContributorReportResponse> {
  const formData = new FormData();
  formData.append("type", input.type);
  formData.append("severity", String(input.severity));
  formData.append("message", input.message);
  formData.append("lat", String(input.lat));
  formData.append("lng", String(input.lng));
  if (input.locationText) formData.append("locationText", input.locationText);
  if (typeof input.ttlMin === "number") formData.append("ttlMin", String(input.ttlMin));
  if (input.photo) formData.append("photo", input.photo);

  const res = await fetch(`${API_BASE}/contributor/reports`, {
    method: "POST",
    headers: {
      "X-CONTRIBUTOR-ID": input.contributorId,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<SubmitContributorReportResponse>;
}

export interface ContributorReport {
  id: string;
  type: string;
  severity: number;
  message: string;
  lat: number;
  lng: number;
  locationText?: string | null;
  photoUrl?: string | null;
  status: "pending" | "approved" | "rejected";
  expiresAt: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export async function getContributorReports(contributorId: string): Promise<{ reports: ContributorReport[] }> {
  const res = await fetch(`${API_BASE}/contributor/reports`, {
    headers: {
      "X-CONTRIBUTOR-ID": contributorId,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ reports: ContributorReport[] }>;
}

export interface RewardLedgerItem {
  id: string;
  reportId: string;
  contributorId: string;
  amount: number;
  status: "earned" | "paid" | "credited";
  createdAt: string;
}

export async function getContributorRewards(
  contributorId: string
): Promise<{ rewards: RewardLedgerItem[]; totalCredits: number }> {
  const res = await fetch(`${API_BASE}/contributor/rewards`, {
    headers: {
      "X-CONTRIBUTOR-ID": contributorId,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ rewards: RewardLedgerItem[]; totalCredits: number }>;
}

export interface AdminReport extends ContributorReport {
  contributor: {
    id: string;
    name: string;
    trustScore: number;
    isBanned: boolean;
  };
}

export async function getAdminReports(
  adminKey: string,
  status: "pending" | "approved" | "rejected" = "pending"
): Promise<{ page: number; pageSize: number; total: number; reports: AdminReport[] }> {
  const res = await fetch(`${API_BASE}/admin/reports?status=${status}`, {
    headers: { "X-ADMIN-KEY": adminKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ page: number; pageSize: number; total: number; reports: AdminReport[] }>;
}

export async function approveAdminReport(
  adminKey: string,
  reportId: string,
  input?: { rewardAmount?: number; expiresAt?: string }
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/admin/reports/${reportId}/approve`, {
    method: "POST",
    headers: { "X-ADMIN-KEY": adminKey },
    body: JSON.stringify(input || {}),
  });
}

export async function rejectAdminReport(
  adminKey: string,
  reportId: string,
  input?: { reason?: string }
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/admin/reports/${reportId}/reject`, {
    method: "POST",
    headers: { "X-ADMIN-KEY": adminKey },
    body: JSON.stringify(input || {}),
  });
}
