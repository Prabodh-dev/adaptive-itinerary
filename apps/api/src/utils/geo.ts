/**
 * Geo utility functions for distance and travel time calculations
 */

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 - Latitude of point 1
 * @param lng1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lng2 - Longitude of point 2
 * @returns Distance in kilometers
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estimate travel time in minutes based on distance and mode
 * @param distanceKm - Distance in kilometers
 * @param mode - Travel mode: driving, walking, or transit
 * @returns Travel time in minutes (clamped between 5 and 90)
 */
export function estimateTravelMin(
  distanceKm: number,
  mode: "driving" | "walking" | "transit"
): number {
  // Speed assumptions (km/h)
  const speeds = {
    driving: 25, // Urban driving with traffic
    walking: 4.5, // Average walking pace
    transit: 18, // Public transit with stops
  };

  const speed = speeds[mode];
  const travelMin = Math.ceil((distanceKm / speed) * 60);

  // Clamp between 5 and 90 minutes
  return Math.min(Math.max(travelMin, 5), 90);
}
