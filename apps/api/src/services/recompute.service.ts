import type { Suggestion } from "@adaptive/types";
import * as store from "../store/store.js";
import {
  buildCommunitySuggestion,
  buildCrowdSuggestion,
  buildTransitSuggestion,
  buildWeatherSuggestion,
} from "./suggestion.service.js";
import { emit } from "../realtime/sseHub.js";
import { getCommunitySignalsForTrip } from "./community-signals.service.js";

export async function recomputeTripSuggestions(tripId: string): Promise<Suggestion[]> {
  const tripData = store.getTrip(tripId);
  if (!tripData) {
    throw new Error(`Trip ${tripId} not found`);
  }

  const { trip, activities, latestItinerary } = tripData;
  const weatherSignal = store.getWeatherSignal(tripId);
  const crowdSignal = store.getCrowdSignals(tripId);
  const transitSignal = store.getTransitSignals(tripId);
  const communityReports = await getCommunitySignalsForTrip(tripId);

  const suggestions = [
    buildCommunitySuggestion(trip, activities, latestItinerary?.itinerary, communityReports),
    buildWeatherSuggestion(trip, activities, latestItinerary?.itinerary, weatherSignal),
    buildCrowdSuggestion(trip, activities, latestItinerary?.itinerary, crowdSignal),
    buildTransitSuggestion(trip, activities, latestItinerary?.itinerary, transitSignal),
  ].filter(Boolean) as Suggestion[];

  for (const suggestion of suggestions) {
    store.addSuggestion(tripId, suggestion);
    emit(tripId, "suggestion:new", suggestion);
  }

  return suggestions;
}
