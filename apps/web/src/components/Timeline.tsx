"use client";
import type { Itinerary } from "@/api/client";

interface TimelineProps {
  itinerary: Itinerary;
  version?: number;
}

export default function Timeline({ itinerary, version }: TimelineProps) {
  const { items, totalTravelMin } = itinerary;

  if (!items || items.length === 0) {
    return <p className="text-sm text-[#5f7569]">No itinerary items to display.</p>;
  }

  return (
    <div className="space-y-4">
      {version !== undefined && (
        <p className="inline-flex rounded-full border border-[#c0d4c7] bg-[#f6faf7] px-3 py-1 text-xs font-semibold text-[#4f6659]">
          Version {version}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={item.activityId} className="relative rounded-xl border border-[#c6d8cc] bg-white/90 p-4">
            <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-gradient-to-b from-teal-500 to-emerald-500" />
            {idx > 0 && item.travelFromPrevMin > 0 && (
              <p className="mb-1 pl-2 text-xs font-medium text-[#668072]">{item.travelFromPrevMin} min travel</p>
            )}
            <p className="pl-2 text-xs font-semibold uppercase tracking-wide text-[#678074]">
              {item.startTime} - {item.endTime}
            </p>
            <p className="pl-2 text-base font-semibold text-[#163327]">{item.placeName}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-[#566e61]">Total travel: {totalTravelMin} min</p>
    </div>
  );
}
