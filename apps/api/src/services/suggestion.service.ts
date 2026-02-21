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
  Weights,
  CrowdSignalItem,
} from "@adaptive/types";
import type { WeatherSignalRecord, CrowdSignalRecord, TransitSignalRecord } from "../store/store.js";
import { buildPlanDiff } from "./diff.service.js";
import { computeImpact, computeConfidence } from "./impact.service.js";
import { parseHHMM, formatHHMM } from "../utils/time.js";

/**
 * Recalculate itinerary times after reordering
 * Note: travel times need to be recalculated separately using Mapbox
 */
function recalculateItineraryTimes(
  items: ItineraryItem[],
  tripStartTime: string
): ItineraryItem[] {
  const tripStartMin = parseHHMM(tripStartTime);
  const recalculated: ItineraryItem[] = [];
  let currentTimeMin = tripStartMin;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // First item always starts at trip start time
    const travelFromPrevMin = i === 0 ? 0 : Math.max(item.travelFromPrevMin, 5);
    const startTime = currentTimeMin + travelFromPrevMin;
    const duration = parseHHMM(item.endTime) - parseHHMM(item.startTime);
    const endTime = startTime + duration;

    recalculated.push({
      ...item,
      startTime: formatHHMM(startTime),
      endTime: formatHHMM(endTime),
      travelFromPrevMin,
    });

    currentTimeMin = endTime;
  }

  return recalculated;
}

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
 * Respects locked activities - locked items stay in their relative positions
 */
function reorderToAvoidRain(
  itineraryItems: ItineraryItem[],
  riskyActivities: { item: ItineraryItem; activity: Activity }[],
  lockedIds: Set<string>
): ItineraryItem[] {
  const riskyIds = new Set(riskyActivities.map((r) => r.item.activityId));

  const lockedItems: ItineraryItem[] = [];
  const nonLockedItems: ItineraryItem[] = [];

  for (const item of itineraryItems) {
    if (lockedIds.has(item.activityId)) {
      lockedItems.push(item);
    } else {
      nonLockedItems.push(item);
    }
  }

  const safeOutdoor: ItineraryItem[] = [];
  const rest: ItineraryItem[] = [];

  for (const item of nonLockedItems) {
    if (riskyIds.has(item.activityId)) {
      safeOutdoor.push(item);
    } else {
      rest.push(item);
    }
  }

  const reorderedNonLocked = [...safeOutdoor, ...rest];
  
  const result: ItineraryItem[] = [];
  let lockedIdx = 0;
  let nonLockedIdx = 0;

  for (const item of itineraryItems) {
    if (lockedIds.has(item.activityId)) {
      result.push(lockedItems[lockedIdx++]);
    } else {
      result.push(reorderedNonLocked[nonLockedIdx++]);
    }
  }

  return result;
}

/**
 * Build a weather-based suggestion
 * Returns null if no suggestion needed
 */
export function buildWeatherSuggestion(
  trip: Trip,
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

  // Respect locked activities
  const lockedIds = new Set(
    activities.filter((a) => a.locked).map((a) => a.activityId)
  );

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

  // Reorder itinerary (respecting locked activities)
  const reorderedItems = reorderToAvoidRain(latestItinerary.items, riskyActivities, lockedIds);

  // Check if there's actually a change - if not, don't create suggestion
  const hasActualChange = reorderedItems.some((item, idx) => 
    item.activityId !== latestItinerary.items[idx]?.activityId
  );
  if (!hasActualChange) {
    console.log("[Suggestion] Weather: No actual reordering needed, skipping suggestion");
    return null;
  }

  // Recalculate times based on new order
  const afterPlanItems = recalculateItineraryTimes(reorderedItems, trip.startTime);

  // Get current version from latestItinerary
  const currentVersion = latestItinerary.totalTravelMin ? 1 : 1;

  // Compute diff, impact, and confidence
  const diff = buildPlanDiff(latestItinerary.items, afterPlanItems);
  const impact = computeImpact(latestItinerary.items, afterPlanItems, "weather");
  const dummyWeights: Weights = {
    weatherWeight: 1.0,
    crowdWeight: 1.0,
    transitWeight: 1.0,
    travelWeight: 1.0,
    changeAversion: 1.0,
  };
  const numChanges = diff.moved.length + diff.swapped.length;
  const confidence = computeConfidence(dummyWeights, "weather", impact, numChanges);

  const suggestion: Suggestion = {
    suggestionId,
    kind: "reorder",
    status: "pending",
    createdAt: new Date().toISOString(),
    trigger: "weather",
    reasons,
    confidence,
    impact,
    beforePlan: {
      version: currentVersion,
      items: latestItinerary.items,
    },
    afterPlan: {
      version: currentVersion + 1,
      items: afterPlanItems,
    },
    diff,
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
    // busyNow can exceed 100 from BestTime live data
    const isVeryBusy = crowdData.busyNow >= 85;
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
 * Respects locked activities - locked items stay in their relative positions
 */
function reorderToAvoidCrowds(
  itineraryItems: ItineraryItem[],
  crowdedActivities: { item: ItineraryItem; activity: Activity; crowdData: CrowdSignalItem }[],
  lockedIds: Set<string>
): ItineraryItem[] {
  const crowdedIds = new Set(crowdedActivities.map((c) => c.item.activityId));

  const lockedItems: ItineraryItem[] = [];
  const nonLockedItems: ItineraryItem[] = [];

  for (const item of itineraryItems) {
    if (lockedIds.has(item.activityId)) {
      lockedItems.push(item);
    } else {
      nonLockedItems.push(item);
    }
  }

  const crowdedItems: ItineraryItem[] = [];
  const rest: ItineraryItem[] = [];

  for (const item of nonLockedItems) {
    if (crowdedIds.has(item.activityId)) {
      crowdedItems.push(item);
    } else {
      rest.push(item);
    }
  }

  const reorderedNonLocked = [...crowdedItems, ...rest];
  
  const result: ItineraryItem[] = [];
  let lockedIdx = 0;
  let nonLockedIdx = 0;

  for (const item of itineraryItems) {
    if (lockedIds.has(item.activityId)) {
      result.push(lockedItems[lockedIdx++]);
    } else {
      result.push(reorderedNonLocked[nonLockedIdx++]);
    }
  }

  return result;
}

/**
 * Build a crowd-based suggestion
 * Returns null if no suggestion needed
 */
export function buildCrowdSuggestion(
  trip: Trip,
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

  // Respect locked activities
  const lockedIds = new Set(
    activities.filter((a) => a.locked).map((a) => a.activityId)
  );

  // Build suggestion
  const suggestionId = `sug_${nanoid(12)}`;

  const reasons: string[] = [];
  
  // Add specific reasons for each crowded place
  for (const { activity, crowdData } of crowdedActivities) {
    const peakDisplay = crowdData.peakHours.length > 0
      ? crowdData.peakHours.slice(0, 2).join(", ")
      : "peak hours";
    
    if (crowdData.busyNow >= 85) {
      // Live busyness may exceed 100
      const displayBusy = Math.min(crowdData.busyNow, 150); // Cap display at 150%
      reasons.push(`${activity.place.name} is very busy around ${peakDisplay} (live busyness ${displayBusy}%)`);
    } else {
      reasons.push(`${activity.place.name} is predicted very busy around ${peakDisplay}`);
    }
  }
  
  reasons.push("Shifted crowded stops earlier to avoid peak hours");

  // Reorder itinerary (respecting locked activities)
  const reorderedItems = reorderToAvoidCrowds(latestItinerary.items, crowdedActivities, lockedIds);

  // Check if there's actually a change - if not, don't create suggestion
  const hasActualChange = reorderedItems.some((item, idx) => 
    item.activityId !== latestItinerary.items[idx]?.activityId
  );
  if (!hasActualChange) {
    console.log("[Suggestion] Crowd: No actual reordering needed, skipping suggestion");
    return null;
  }

  // Recalculate times based on new order
  const afterPlanItems = recalculateItineraryTimes(reorderedItems, trip.startTime);

  // Compute diff, impact, and confidence
  const diff = buildPlanDiff(latestItinerary.items, afterPlanItems);
  const impact = computeImpact(latestItinerary.items, afterPlanItems, "crowds");
  const dummyWeights: Weights = {
    weatherWeight: 1.0,
    crowdWeight: 1.0,
    transitWeight: 1.0,
    travelWeight: 1.0,
    changeAversion: 1.0,
  };
  const numChanges = diff.moved.length + diff.swapped.length;
  const confidence = computeConfidence(dummyWeights, "crowds", impact, numChanges);

  const suggestion: Suggestion = {
    suggestionId,
    kind: "shift",
    status: "pending",
    createdAt: new Date().toISOString(),
    trigger: "crowds",
    reasons,
    confidence,
    impact,
    beforePlan: {
      version: 1,
      items: latestItinerary.items,
    },
    afterPlan: {
      version: 2,
      items: afterPlanItems,
    },
    diff,
  };

  return suggestion;
}

/**
 * Build a transit-based suggestion
 * Returns null if no suggestion needed
 */
export function buildTransitSuggestion(
  trip: Trip,
  activities: Activity[],
  latestItinerary: Itinerary | undefined,
  transitSignal: TransitSignalRecord | null
): Suggestion | null {
  // No transit data
  if (!transitSignal || transitSignal.alerts.length === 0) {
    return null;
  }

  // No itinerary yet
  if (!latestItinerary || latestItinerary.items.length === 0) {
    return null;
  }

  // Get TRANSIT_DELAY_THRESHOLD_MIN from env, default to 10
  const delayThreshold = parseInt(process.env.TRANSIT_DELAY_THRESHOLD_MIN || "10", 10);

  // Find significant delays
  const significantDelays = transitSignal.alerts.filter(
    (alert) => alert.delayMin >= delayThreshold
  );

  if (significantDelays.length === 0) {
    return null;
  }

  // Respect locked activities
  const lockedIds = new Set(
    activities.filter((a) => a.locked).map((a) => a.activityId)
  );

  // Build reasons
  const reasons: string[] = [];
  let totalDelay = 0;
  for (const alert of significantDelays) {
    reasons.push(
      `Transit delay detected: ${alert.line} delayed by ${alert.delayMin} min`
    );
    totalDelay += alert.delayMin;
  }
  reasons.push("Reordered nearby stops to reduce idle time during delays");

  // Simple reorder strategy: move first 1-2 non-locked items later
  // This gives more buffer time if user is starting their trip
  const itemsToShift: ItineraryItem[] = [];
  const restItems: ItineraryItem[] = [];

  let shiftedCount = 0;
  const maxToShift = 2;

  for (const item of latestItinerary.items) {
    if (lockedIds.has(item.activityId)) {
      // Keep locked items in order
      restItems.push(item);
    } else if (shiftedCount < maxToShift) {
      // Shift these items later
      itemsToShift.push(item);
      shiftedCount++;
    } else {
      restItems.push(item);
    }
  }

  // New order: rest items first, then shifted items (gives buffer at start)
  const reorderedItems: ItineraryItem[] = [];
  reorderedItems.push(...restItems, ...itemsToShift);

  // Check if there's actually a change - if not, don't create suggestion
  const hasActualChange = reorderedItems.some((item, idx) => 
    item.activityId !== latestItinerary.items[idx]?.activityId
  );
  if (!hasActualChange) {
    console.log("[Suggestion] Transit: No actual reordering needed, skipping suggestion");
    return null;
  }

  // Recalculate times based on new order
  const afterPlanItems = recalculateItineraryTimes(reorderedItems, trip.startTime);

  const suggestionId = `sug_${nanoid(10)}`;

  // Compute diff, impact, and confidence
  const diff = buildPlanDiff(latestItinerary.items, afterPlanItems);
  const impact = computeImpact(latestItinerary.items, afterPlanItems, "transit");
  impact.delayAvoidedMin = totalDelay;
  const dummyWeights: Weights = {
    weatherWeight: 1.0,
    crowdWeight: 1.0,
    transitWeight: 1.0,
    travelWeight: 1.0,
    changeAversion: 1.0,
  };
  const numChanges = diff.moved.length + diff.swapped.length;
  const confidence = computeConfidence(dummyWeights, "transit", impact, numChanges);

  const suggestion: Suggestion = {
    suggestionId,
    kind: "reorder",
    status: "pending",
    createdAt: new Date().toISOString(),
    trigger: "transit",
    reasons,
    confidence,
    impact,
    beforePlan: {
      version: 1,
      items: latestItinerary.items,
    },
    afterPlan: {
      version: 2,
      items: afterPlanItems,
    },
    diff,
  };

  return suggestion;
}
