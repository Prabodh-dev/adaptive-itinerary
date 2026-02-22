"use client";

import { useEffect, useState } from "react";
import { applySuggestion, getSuggestions, sendFeedback, type Suggestion } from "@/api/client";
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
    return <p className="text-sm text-[#5a7063]">Loading suggestions...</p>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  }

  if (suggestions.length === 0) {
    return <p className="text-sm text-[#5a7063]">No suggestions available yet.</p>;
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <div key={suggestion.suggestionId} className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded bg-[#dff4ec] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#205843]">
              {suggestion.kind}
            </span>
            {suggestion.trigger && (
              <span className="rounded bg-[#edf3ef] px-2 py-1 text-xs font-semibold text-[#4b6054]">
                Trigger: {suggestion.trigger}
              </span>
            )}
          </div>

          {suggestion.reasons && suggestion.reasons.length > 0 && (
            <ul className="mb-3 list-inside list-disc text-sm text-[#42594d]">
              {suggestion.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          )}

          <DiffView suggestion={suggestion} />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => handleAccept(suggestion.suggestionId)}
              disabled={applying === suggestion.suggestionId}
              className="btn-brand px-3 py-1.5 text-sm"
            >
              {applying === suggestion.suggestionId ? "Applying..." : "Accept"}
            </button>
            <button
              onClick={() => handleDismiss(suggestion.suggestionId)}
              className="btn-subtle px-3 py-1.5 text-sm text-[#2f4b3d]"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
