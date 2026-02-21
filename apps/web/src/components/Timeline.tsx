"use client";
import type { Itinerary } from "@/api/client";

interface TimelineProps {
  itinerary: Itinerary;
  version?: number;
}

export default function Timeline({ itinerary, version }: TimelineProps) {
  const { items, totalTravelMin } = itinerary;

  if (!items || items.length === 0) {
    return <p className="text-gray-500">No itinerary items to display.</p>;
  }

  return (
    <div>
      {version !== undefined && (
        <p className="mb-2 text-xs font-medium text-gray-500">Version {version}</p>
      )}
      <ul className="space-y-4">
        {items.map((item, idx) => (
          <li key={item.activityId} className="relative border-l-2 border-blue-400 pl-6 pb-2">
            <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-blue-500" />
            {idx > 0 && item.travelFromPrevMin > 0 && (
              <p className="mb-1 text-xs text-gray-400">{item.travelFromPrevMin} min travel</p>
            )}
            <p className="text-sm font-semibold text-gray-700">{item.startTime} – {item.endTime}</p>
            <p className="text-base text-gray-900">{item.placeName}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-gray-500">Total travel: {totalTravelMin} min</p>
    </div>
  );
}
