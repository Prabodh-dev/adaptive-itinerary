export type LatLng = { lat: number; lng: number };

export type Place = {
  provider: string;
  providerPlaceId: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  isIndoor?: boolean;
  address?: string;
};

export type ItineraryItem = {
  activityId: string;
  placeName: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  travelFromPrevMin: number;
};

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
