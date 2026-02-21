/**
 * Alternatives service - Find alternative places for swap suggestions
 */
import type { Place, Activity, SuggestionTrigger } from "@adaptive/types";
import { searchPlacesFoursquare } from "@adaptive/integrations";

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || "";

export interface AlternativeResult {
  originalPlace: Place;
  alternativePlace: Place;
  reason: string;
}

/**
 * Find an alternative for an activity using Foursquare nearby search
 */
export async function findAlternativeForActivity({
  activity,
  trigger,
  radiusKm = 3,
}: {
  activity: Activity;
  trigger: SuggestionTrigger;
  radiusKm?: number;
}): Promise<AlternativeResult | null> {
  if (!FOURSQUARE_API_KEY) {
    console.warn("[Alternatives] Foursquare API key not configured");
    return null;
  }

  const originalPlace = activity.place;

  // Build search query from category or name
  const query = originalPlace.category 
    ? originalPlace.category 
    : originalPlace.name.split(" ")[0]; // Use first word of name as fallback

  try {
    const alternatives = await searchPlacesFoursquare(
      query,
      { lat: originalPlace.lat, lng: originalPlace.lng },
      radiusKm,
      undefined, // categories
      10, // limit
      FOURSQUARE_API_KEY
    );

    // Filter out the original place
    const validAlternatives = alternatives.filter(
      (p) => p.providerPlaceId !== originalPlace.providerPlaceId
    );

    if (validAlternatives.length === 0) {
      console.log(`[Alternatives] No alternatives found for ${originalPlace.name}`);
      return null;
    }

    // Prefer indoor places for weather trigger
    let bestAlternative = validAlternatives[0];
    
    if (trigger === "weather") {
      const indoorAlternative = validAlternatives.find((p) => p.isIndoor === true);
      if (indoorAlternative) {
        bestAlternative = indoorAlternative;
      }
    }

    let reason = "";
    switch (trigger) {
      case "weather":
        reason = `Indoor alternative due to rain risk at ${originalPlace.name}`;
        break;
      case "crowds":
        reason = `Less crowded alternative to ${originalPlace.name}`;
        break;
      case "transit":
      case "traffic":
        reason = `Alternative due to transit issues near ${originalPlace.name}`;
        break;
      default:
        reason = `Alternative to ${originalPlace.name}`;
    }

    return {
      originalPlace,
      alternativePlace: bestAlternative,
      reason,
    };
  } catch (error) {
    console.error("[Alternatives] Error finding alternative:", error);
    return null;
  }
}
