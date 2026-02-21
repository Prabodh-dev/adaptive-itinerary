"use client";

interface Alternative {
  name: string;
  lat: number;
  lng: number;
  category?: string;
  distance?: number;
  reason?: string;
}

interface AlternativesPanelProps {
  alternatives?: Alternative[];
}

export default function AlternativesPanel({ alternatives }: AlternativesPanelProps) {
  if (!alternatives || alternatives.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-blue-700">Alternative Places</h4>
      <ul className="space-y-2">
        {alternatives.map((alt, idx) => (
          <li key={idx} className="flex items-start justify-between rounded bg-white p-2">
            <div>
              <p className="text-sm font-medium text-gray-900">{alt.name}</p>
              {alt.category && (
                <p className="text-xs text-gray-500">{alt.category}</p>
              )}
              {alt.reason && (
                <p className="text-xs text-blue-600">{alt.reason}</p>
              )}
            </div>
            {alt.distance !== undefined && (
              <span className="text-xs text-gray-400">
                {(alt.distance * 1000).toFixed(0)}m
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
