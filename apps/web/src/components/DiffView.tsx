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

  const numChanges = diff ? diff.moved.length + diff.swapped.length : 0;

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-gray-700">Changes</h4>

      {diff && diff.summary && (
        <p className="mb-2 text-sm text-gray-600">{diff.summary}</p>
      )}

      {diff && diff.moved && diff.moved.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-500">Moved:</p>
          <ul className="ml-2 list-disc text-xs text-gray-600">
            {diff.moved.map((item, idx) => (
              <li key={idx}>
                <span className="font-medium">{item.placeName}</span>
                <span className="text-gray-400">: {item.from} → {item.to}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff && diff.swapped && diff.swapped.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-500">Swapped:</p>
          <ul className="ml-2 list-disc text-xs text-gray-600">
            {diff.swapped.map((item, idx) => (
              <li key={idx}>
                <span className="font-medium">{item.fromPlace}</span>
                <span className="text-gray-400"> ↔ </span>
                <span className="font-medium">{item.toPlace}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact && (
        <div className="mt-2 border-t border-gray-200 pt-2">
          <p className="text-xs font-medium text-gray-500">Impact:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {impact.travelSavedMin !== undefined && impact.travelSavedMin > 0 && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                {impact.travelSavedMin}min saved
              </span>
            )}
            {impact.weatherRiskReduced !== undefined && impact.weatherRiskReduced > 0 && (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                -{Math.round(impact.weatherRiskReduced * 100)}% weather risk
              </span>
            )}
            {impact.crowdReduced !== undefined && impact.crowdReduced > 0 && (
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                -{Math.round(impact.crowdReduced * 100)}% crowds
              </span>
            )}
            {impact.delayAvoidedMin !== undefined && impact.delayAvoidedMin > 0 && (
              <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                {impact.delayAvoidedMin}min delay avoided
              </span>
            )}
          </div>
        </div>
      )}

      {suggestion.confidence !== undefined && (
        <div className="mt-2 border-t border-gray-200 pt-2">
          <p className="text-xs text-gray-500">
            Confidence: <span className="font-medium">{Math.round(suggestion.confidence * 100)}%</span>
          </p>
        </div>
      )}

      {beforePlan && afterPlan && (
        <div className="mt-2 border-t border-gray-200 pt-2">
          <p className="text-xs text-gray-500">
            Version: <span className="font-medium">v{beforePlan.version}</span>
            <span className="text-gray-400"> → </span>
            <span className="font-medium">v{afterPlan.version}</span>
          </p>
        </div>
      )}
    </div>
  );
}
