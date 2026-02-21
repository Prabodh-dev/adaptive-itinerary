/**
 * Diff service - Build human-readable diffs between itinerary plans
 */
import type { ItineraryItem, SuggestionDiff } from "@adaptive/types";

/**
 * Build a diff between before and after itinerary plans
 */
export function buildPlanDiff(
  beforeItems: ItineraryItem[],
  afterItems: ItineraryItem[]
): SuggestionDiff {
  const moved: SuggestionDiff["moved"] = [];
  const swapped: SuggestionDiff["swapped"] = [];

  // Create maps for quick lookup
  const beforeMap = new Map(beforeItems.map((item) => [item.activityId, item]));

  // Track which activity IDs are in after plan
  const afterIds = new Set(afterItems.map((i) => i.activityId));
  const beforeIds = new Set(beforeItems.map((i) => i.activityId));

  // Find moved items (same activity, different time/position)
  for (const afterItem of afterItems) {
    const beforeItem = beforeMap.get(afterItem.activityId);
    if (beforeItem) {
      if (beforeItem.startTime !== afterItem.startTime) {
        moved.push({
          placeName: afterItem.placeName,
          from: beforeItem.startTime,
          to: afterItem.startTime,
        });
      }
    }
  }

  // Find swapped items (activity in before but not in after at same position)
  const beforePositions = new Map<string, number>();
  const afterPositions = new Map<string, number>();

  beforeItems.forEach((item, idx) => beforePositions.set(item.activityId, idx));
  afterItems.forEach((item, idx) => afterPositions.set(item.activityId, idx));

  // Detect swaps: items that replaced each other
  for (let i = 0; i < Math.min(beforeItems.length, afterItems.length); i++) {
    const beforeId = beforeItems[i].activityId;
    const afterId = afterItems[i].activityId;

    if (beforeId !== afterId && beforeIds.has(afterId) && afterIds.has(beforeId)) {
      // This is a swap
      const fromPlace = afterItems[i].placeName;
      const toPlace = beforeItems[i].placeName;
      
      // Avoid duplicate swaps
      if (!swapped.some(s => s.fromPlace === fromPlace && s.toPlace === toPlace)) {
        swapped.push({
          fromPlace: beforeItems[i].placeName,
          toPlace: afterItems[i].placeName,
        });
      }
    }
  }

  // Build summary
  const changes = moved.length + swapped.length;
  let summary = "";
  if (changes === 0) {
    summary = "No changes";
  } else if (swapped.length > 0) {
    summary = `Swapped ${swapped.length} place${swapped.length > 1 ? "s" : ""}`;
  } else if (moved.length > 0) {
    summary = `Reordered ${moved.length} place${moved.length > 1 ? "s" : ""}`;
  }

  return {
    moved,
    swapped,
    summary,
  };
}
