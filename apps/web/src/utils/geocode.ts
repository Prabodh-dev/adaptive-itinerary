// Simple city coordinates lookup
// In production, this would call a geocoding API

const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  chennai: { lat: 13.0827, lng: 80.2707 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.7041, lng: 77.1025 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  paris: { lat: 48.8566, lng: 2.3522 },
  london: { lat: 51.5074, lng: -0.1278 },
  "new york": { lat: 40.7128, lng: -74.006 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  "san francisco": { lat: 37.7749, lng: -122.4194 },
  singapore: { lat: 1.3521, lng: 103.8198 },
};

export function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  const normalized = cityName.toLowerCase().trim();
  return cityCoordinates[normalized] || null;
}
