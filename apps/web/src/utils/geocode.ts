/**
 * Simple geocoding utility for common cities
 * Maps city names to their coordinates
 */

interface CityCoordinates {
  lat: number;
  lng: number;
}

const CITY_COORDINATES: Record<string, CityCoordinates> = {
  // India
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  delhi: { lat: 28.7041, lng: 77.1025 },
  "new delhi": { lat: 28.7041, lng: 77.1025 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  pune: { lat: 18.5204, lng: 73.8567 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  surat: { lat: 21.1702, lng: 72.8311 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  indore: { lat: 22.7196, lng: 75.8577 },
  thane: { lat: 19.2183, lng: 72.9781 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  pimpri: { lat: 18.6298, lng: 73.7997 },
  patna: { lat: 25.5941, lng: 85.1376 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  ghaziabad: { lat: 28.6692, lng: 77.4538 },
  ludhiana: { lat: 30.9010, lng: 75.8573 },
  agra: { lat: 27.1767, lng: 78.0081 },
  nashik: { lat: 19.9975, lng: 73.7898 },
  faridabad: { lat: 28.4089, lng: 77.3178 },
  meerut: { lat: 28.9845, lng: 77.7064 },
  rajkot: { lat: 22.3039, lng: 70.8022 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  
  // International
  london: { lat: 51.5074, lng: -0.1278 },
  paris: { lat: 48.8566, lng: 2.3522 },
  "new york": { lat: 40.7128, lng: -74.0060 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  "hong kong": { lat: 22.3193, lng: 114.1694 },
  "kuala lumpur": { lat: 3.1390, lng: 101.6869 },
  rome: { lat: 41.9028, lng: 12.4964 },
  barcelona: { lat: 41.3851, lng: 2.1734 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  berlin: { lat: 52.5200, lng: 13.4050 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  prague: { lat: 50.0755, lng: 14.4378 },
  istanbul: { lat: 41.0082, lng: 28.9784 },
  moscow: { lat: 55.7558, lng: 37.6173 },
  "los angeles": { lat: 34.0522, lng: -118.2437 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  toronto: { lat: 43.6532, lng: -79.3832 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  beijing: { lat: 39.9042, lng: 116.4074 },
  shanghai: { lat: 31.2304, lng: 121.4737 },
  seoul: { lat: 37.5665, lng: 126.9780 },
};

/**
 * Get coordinates for a city name
 * @param cityName - Name of the city (case-insensitive)
 * @returns Coordinates if found, or default Bangalore coordinates if not found
 */
export function getCityCoordinates(cityName: string): CityCoordinates {
  const normalizedCity = cityName.toLowerCase().trim();
  
  // Direct match
  if (CITY_COORDINATES[normalizedCity]) {
    return CITY_COORDINATES[normalizedCity];
  }
  
  // Try partial match (e.g., "Bangalore City" matches "bangalore")
  const partialMatch = Object.keys(CITY_COORDINATES).find(key => 
    normalizedCity.includes(key) || key.includes(normalizedCity)
  );
  
  if (partialMatch) {
    return CITY_COORDINATES[partialMatch];
  }
  
  // Default to Bangalore if not found
  console.warn(`City "${cityName}" not found in database, defaulting to Bangalore`);
  return { lat: 12.9716, lng: 77.5946 };
}

/**
 * Check if a city is in the database
 * @param cityName - Name of the city (case-insensitive)
 * @returns true if city is found, false otherwise
 */
export function isCityKnown(cityName: string): boolean {
  const normalizedCity = cityName.toLowerCase().trim();
  return normalizedCity in CITY_COORDINATES;
}
