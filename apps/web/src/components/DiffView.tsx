"use client";

import type { Suggestion } from "@/api/client";

interface DiffViewProps {
  suggestion: Suggestion;
}

export default function DiffView({ suggestion }: DiffViewProps) {
  const { diff, beforePlan, afterPlan, impact } = suggestion;

  if (!diff && !beforePlan && !afterPlan) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[#d4e2d8] bg-[#f8fbf9] p-3">
      <h4 className="mb-2 text-sm font-semibold text-[#2f4b3d]">Changes</h4>

      {diff && diff.summary && <p className="mb-2 text-sm text-[#52675a]">{diff.summary}</p>}

      {diff && diff.moved && diff.moved.length > 0 && (
        <div className="mb-2 rounded-lg border border-[#d8e6dc] bg-white p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#556c60]">Moved</p>
          <ul className="mt-1 space-y-1 text-xs text-[#566d61]">
            {diff.moved.map((item, idx) => (
              <li key={idx}>
                <span className="font-semibold text-[#2f4b3d]">{item.placeName}</span> {item.from} to {item.to}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff && diff.swapped && diff.swapped.length > 0 && (
        <div className="mb-2 rounded-lg border border-[#d8e6dc] bg-white p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#556c60]">Swapped</p>
          <ul className="mt-1 space-y-1 text-xs text-[#566d61]">
            {diff.swapped.map((item, idx) => (
              <li key={idx}>
                <span className="font-semibold text-[#2f4b3d]">{item.fromPlace}</span> with{" "}
                <span className="font-semibold text-[#2f4b3d]">{item.toPlace}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact && (
        <div className="mt-2 border-t border-[#d8e6dc] pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#556c60]">Impact</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {impact.travelSavedMin !== undefined && impact.travelSavedMin > 0 && (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {impact.travelSavedMin} min saved
              </span>
            )}
            {impact.weatherRiskReduced !== undefined && impact.weatherRiskReduced > 0 && (
              <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                {Math.round(impact.weatherRiskReduced * 100)}% less weather risk
              </span>
            )}
            {impact.crowdReduced !== undefined && impact.crowdReduced > 0 && (
              <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {Math.round(impact.crowdReduced * 100)}% less crowd
              </span>
            )}
            {impact.delayAvoidedMin !== undefined && impact.delayAvoidedMin > 0 && (
              <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                {impact.delayAvoidedMin} min delay avoided
              </span>
            )}
          </div>
        </div>
      )}

      {suggestion.confidence !== undefined && (
        <p className="mt-2 border-t border-[#d8e6dc] pt-2 text-xs text-[#546b5f]">
          Confidence: <span className="font-semibold">{Math.round(suggestion.confidence * 100)}%</span>
        </p>
      )}

      {beforePlan && afterPlan && (
        <p className="mt-1 text-xs text-[#546b5f]">
          Version: <span className="font-semibold">v{beforePlan.version}</span> to{" "}
          <span className="font-semibold">v{afterPlan.version}</span>
        </p>
      )}
    </div>
  );
}
