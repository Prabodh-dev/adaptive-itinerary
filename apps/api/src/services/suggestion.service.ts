/**
 * Suggestion service - Build weather and crowd-based suggestions
 */
import { nanoid } from "nanoid";
import type {
  Trip,
  Activity,
  Itinerary,
  ItineraryItem,
  Suggestion,
  CrowdSignalItem,
} from "@adaptive/types";
import type { WeatherSignalRecord, CrowdSignalRecord } from "../store/store.js";

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

/**
 * Parse time string (HH:mm) to hour number
 */
function parseTimeHour(time: string): number {
  const [hours] = time.split(":").map(Number);
  return hours;
}

/**
 * Check if a time falls within peak hours
 */
function isTimeInPeakHours(time: string, peakHours: string[]): boolean {
  const hour = parseTimeHour(time);
  
  for (const peakHour of peakHours) {
    const peakH = parseTimeHour(peakHour);
    // Check if within 1 hour window
    if (Math.abs(hour - peakH) <= 1) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find activities scheduled during peak crowd hours
 */
function findCrowdedActivities(
  itineraryItems: ItineraryItem[],
  activities: Activity[],
  crowdSignals: CrowdSignalItem[]
): { item: ItineraryItem; activity: Activity; crowdData: CrowdSignalItem }[] {
  const crowded: { item: ItineraryItem; activity: Activity; crowdData: CrowdSignalItem }[] = [];

  for (const item of itineraryItems) {
    // Find corresponding activity
    const activity = activities.find((a) => a.activityId === item.activityId);
    if (!activity) continue;

    // Find crowd data for this place
    const crowdData = crowdSignals.find(
      (c) => c.placeId === activity.place.providerPlaceId
    );
    if (!crowdData) continue;

    // Check if currently very busy OR scheduled during peak hours
    const isVeryBusy = crowdData.busyNow >= 80;
    const isDuringPeak = 
      isTimeInPeakHours(item.startTime, crowdData.peakHours) ||
      isTimeInPeakHours(item.endTime, crowdData.peakHours);

    if (isVeryBusy || isDuringPeak) {
      crowded.push({ item, activity, crowdData });
    }
  }

  return crowded;
}

/**
 * Reorder itinerary to move crowded activities earlier
 * Respects locked activities
 */
function reorderToAvoidCrowds(
  itineraryItems: ItineraryItem[],
  crowdedActivities: { item: ItineraryItem; activity: Activity; crowdData: CrowdSignalItem }[]
): ItineraryItem[] {
  const crowdedIds = new Set(crowdedActivities.map((c) => c.item.activityId));

  // Split into crowded (move first) and rest
  const crowdedItems: ItineraryItem[] = [];
  const rest: ItineraryItem[] = [];

  for (const item of itineraryItems) {
    if (crowdedIds.has(item.activityId)) {
      crowdedItems.push(item);
    } else {
      rest.push(item);
    }
  }

  // Reorder: crowded items first (visit earlier to avoid crowds), then rest
  return [...crowdedItems, ...rest];
}

/**
 * Build a crowd-based suggestion
 * Returns null if no suggestion needed
 */
export function buildCrowdSuggestion(
  _trip: Trip,
  activities: Activity[],
  latestItinerary: Itinerary | undefined,
  crowdSignalRecord: CrowdSignalRecord | null
): Suggestion | null {
  // No crowd data
  if (!crowdSignalRecord || crowdSignalRecord.crowds.length === 0) {
    return null;
  }

  // No itinerary
  if (!latestItinerary || latestItinerary.items.length === 0) {
    return null;
  }

  // Find crowded activities
  const crowdedActivities = findCrowdedActivities(
    latestItinerary.items,
    activities,
    crowdSignalRecord.crowds
  );

  // No crowded activities
  if (crowdedActivities.length === 0) {
    return null;
  }

  // Build suggestion
  const suggestionId = `sug_${nanoid(12)}`;

  const reasons: string[] = [];
  
  // Add specific reasons for each crowded place
  for (const { activity, crowdData } of crowdedActivities) {
    const peakDisplay = crowdData.peakHours.length > 0
      ? crowdData.peakHours.slice(0, 2).join(", ")
      : "peak hours";
    
    if (crowdData.busyNow >= 80) {
      reasons.push(`${activity.place.name} is very busy right now (${crowdData.busyNow}% capacity)`);
    } else {
      reasons.push(`${activity.place.name} is predicted very busy around ${peakDisplay}`);
    }
  }
  
  reasons.push("Shifted crowded stops earlier to avoid peak hours");

  // Reorder itinerary
  const afterPlanItems = reorderToAvoidCrowds(latestItinerary.items, crowdedActivities);

  const suggestion: Suggestion = {
    suggestionId,
    kind: "shift",
    reasons,
    benefit: {
      crowdExposureReduced: 0.6,
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
