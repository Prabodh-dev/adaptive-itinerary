/**
 * Suggestion service - Build weather-based suggestions
 */
import { nanoid } from "nanoid";
import type {
  Trip,
  Activity,
  Itinerary,
  ItineraryItem,
  Suggestion,
} from "@adaptive/types";
import type { WeatherSignalRecord } from "../store/store.js";

/**
 * Check if a time falls within risk hours
 */
function isTimeInRiskHours(time: string, riskHours: string[]): boolean {
  const [hours, minutes] = time.split(":").map(Number);
  const timeMinutes = hours * 60 + minutes;

  for (const riskHour of riskHours) {
    const [riskH, riskM] = riskHour.split(":").map(Number);
    const riskMinutes = riskH * 60 + riskM;

    // Check if time is within 30 minutes of risk hour
    if (Math.abs(timeMinutes - riskMinutes) <= 30) {
      return true;
    }
  }

  return false;
}

/**
 * Find activities that are outdoor and scheduled during risk hours
 */
function findRiskyOutdoorActivities(
  itineraryItems: ItineraryItem[],
  activities: Activity[],
  riskHours: string[]
): { item: ItineraryItem; activity: Activity }[] {
  const risky: { item: ItineraryItem; activity: Activity }[] = [];

  for (const item of itineraryItems) {
    // Find corresponding activity
    const activity = activities.find((a) => a.activityId === item.activityId);
    if (!activity) continue;

    // Check if outdoor (isIndoor === false or undefined means potentially outdoor)
    const isOutdoor = activity.place.isIndoor === false || activity.place.isIndoor === undefined;
    if (!isOutdoor) continue;

    // Check if scheduled during risk hours
    if (isTimeInRiskHours(item.startTime, riskHours) || isTimeInRiskHours(item.endTime, riskHours)) {
      risky.push({ item, activity });
    }
  }

  return risky;
}

/**
 * Reorder itinerary to move outdoor activities earlier
 */
function reorderToAvoidRain(
  itineraryItems: ItineraryItem[],
  riskyActivities: { item: ItineraryItem; activity: Activity }[]
): ItineraryItem[] {
  const riskyIds = new Set(riskyActivities.map((r) => r.item.activityId));

  // Split into safe outdoor (move first) and rest
  const safeOutdoor: ItineraryItem[] = [];
  const rest: ItineraryItem[] = [];

  for (const item of itineraryItems) {
    if (riskyIds.has(item.activityId)) {
      safeOutdoor.push(item);
    } else {
      rest.push(item);
    }
  }

  // Reorder: safe outdoor first, then rest
  return [...safeOutdoor, ...rest];
}

/**
 * Build a weather-based suggestion
 * Returns null if no suggestion needed
 */
export function buildWeatherSuggestion(
  _trip: Trip,
  activities: Activity[],
  latestItinerary: Itinerary | undefined,
  weatherSignal: WeatherSignalRecord | null
): Suggestion | null {
  // No weather data
  if (!weatherSignal || weatherSignal.riskHours.length === 0) {
    return null;
  }

  // No itinerary
  if (!latestItinerary || latestItinerary.items.length === 0) {
    return null;
  }

  // Find risky outdoor activities
  const riskyActivities = findRiskyOutdoorActivities(
    latestItinerary.items,
    activities,
    weatherSignal.riskHours
  );

  // No risky activities
  if (riskyActivities.length === 0) {
    return null;
  }

  // Build suggestion
  const suggestionId = `sug_${nanoid(12)}`;

  // Format risk hours for display
  const riskHoursDisplay =
    weatherSignal.riskHours.length > 2
      ? `${weatherSignal.riskHours[0]}–${weatherSignal.riskHours[weatherSignal.riskHours.length - 1]}`
      : weatherSignal.riskHours.join(", ");

  const reasons = [
    `Rain risk detected during ${riskHoursDisplay}`,
    `${riskyActivities.length} outdoor ${riskyActivities.length === 1 ? "activity" : "activities"} scheduled during rain risk`,
    "Moved outdoor stops earlier to avoid rain",
  ];

  // Reorder itinerary
  const afterPlanItems = reorderToAvoidRain(latestItinerary.items, riskyActivities);

  const suggestion: Suggestion = {
    suggestionId,
    kind: "reorder",
    reasons,
    benefit: {
      weatherRiskReduced: 0.5,
    },
    beforePlan: {
      items: latestItinerary.items,
    },
    afterPlan: {
      items: afterPlanItems,
    },
  };

  return suggestion;
}
