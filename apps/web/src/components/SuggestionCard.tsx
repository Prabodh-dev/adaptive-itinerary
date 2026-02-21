"use client";

import { useEffect, useState } from "react";
import { getSuggestions, applySuggestion, sendFeedback, type Suggestion, type ListSuggestionsResponse } from "@/api/client";
import DiffView from "./DiffView";

interface SuggestionCardProps {
  tripId: string;
  onSuggestionApplied: () => void;
}

export default function SuggestionCard({ tripId, onSuggestionApplied }: SuggestionCardProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  async function fetchSuggestions() {
    try {
      const data = await getSuggestions(tripId, "pending");
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuggestions();
  }, [tripId]);

  async function handleAccept(suggestionId: string) {
    setApplying(suggestionId);
    try {
      await applySuggestion(tripId, suggestionId);
      await sendFeedback(tripId, suggestionId, "accept");
      await fetchSuggestions();
      onSuggestionApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply suggestion");
    } finally {
      setApplying(null);
    }
  }

  async function handleDismiss(suggestionId: string) {
    try {
      await sendFeedback(tripId, suggestionId, "reject");
      setSuggestions((prev) => prev.filter((s) => s.suggestionId !== suggestionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss suggestion");
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Loading suggestions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">No suggestions available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Suggestions</h3>
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.suggestionId}
          className="rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded bg-amber-200 px-2 py-1 text-xs font-medium text-amber-800">
              {suggestion.kind.toUpperCase()}
            </span>
            {suggestion.trigger && (
              <span className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
                Trigger: {suggestion.trigger}
              </span>
            )}
          </div>

          {suggestion.reasons && suggestion.reasons.length > 0 && (
            <ul className="mb-3 list-inside list-disc text-sm text-gray-700">
              {suggestion.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          )}

          <DiffView suggestion={suggestion} />

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleAccept(suggestion.suggestionId)}
              disabled={applying === suggestion.suggestionId}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {applying === suggestion.suggestionId ? "Applying..." : "Accept"}
            </button>
            <button
              onClick={() => handleDismiss(suggestion.suggestionId)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
