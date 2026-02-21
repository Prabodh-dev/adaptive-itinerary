/**
 * Impact service - Compute impact metrics for suggestions
 */
import type { ItineraryItem, SuggestionTrigger, SuggestionImpact, Weights } from "@adaptive/types";

/**
 * Calculate total travel time from itinerary items
 */
function calculateTotalTravel(items: ItineraryItem[]): number {
  return items.reduce((total, item) => total + item.travelFromPrevMin, 0);
}

/**
 * Compute impact metrics for a suggestion
 */
export function computeImpact(
  beforeItems: ItineraryItem[],
  afterItems: ItineraryItem[],
  trigger: SuggestionTrigger
): SuggestionImpact {
  const beforeTravel = calculateTotalTravel(beforeItems);
  const afterTravel = calculateTotalTravel(afterItems);
  
  const impact: SuggestionImpact = {
    travelSavedMin: Math.max(0, beforeTravel - afterTravel),
  };

  if (trigger === "weather") {
    impact.weatherRiskReduced = 0.5; // Placeholder - could be computed from risk hours overlap
  } else if (trigger === "crowds") {
    impact.crowdReduced = 0.4; // Placeholder - could be computed from crowd signal difference
  } else if (trigger === "transit" || trigger === "traffic") {
    impact.delayAvoidedMin = 10; // Placeholder - could be computed from transit alerts
  }

  return impact;
}

/**
 * Compute confidence score for a suggestion
 */
export function computeConfidence(
  _weights: Weights,
  _trigger: SuggestionTrigger,
  impact: SuggestionImpact,
  numChanges: number
): number {
  let base = 0.55;

  if (impact.travelSavedMin && impact.travelSavedMin >= 10) {
    base += 0.1;
  }

  if (impact.delayAvoidedMin && impact.delayAvoidedMin >= 10) {
    base += 0.1;
  }

  // Penalize for number of changes
  base -= 0.05 * numChanges;

  // Clamp between 0.3 and 0.95
  return Math.max(0.3, Math.min(0.95, base));
}
