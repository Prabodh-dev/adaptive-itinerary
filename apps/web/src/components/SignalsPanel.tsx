"use client";

import { useEffect, useState } from "react";
import { getSignals, type SignalsResponse } from "@/api/client";

interface SignalsPanelProps {
  tripId: string;
}

function getCrowdColor(busyNow: number): { bg: string; text: string; label: string } {
  if (busyNow < 40) {
    return { bg: "bg-green-100", text: "text-green-700", label: "Low" };
  } else if (busyNow < 70) {
    return { bg: "bg-yellow-100", text: "text-yellow-700", label: "Medium" };
  } else {
    return { bg: "bg-red-100", text: "text-red-700", label: "High" };
  }
}

export default function SignalsPanel({ tripId }: SignalsPanelProps) {
  const [signals, setSignals] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSignals() {
      try {
        const data = await getSignals(tripId);
        setSignals(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load signals");
      } finally {
        setLoading(false);
      }
    }

    fetchSignals();
  }, [tripId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Loading signals...</p>
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

  if (!signals?.weather && (!signals?.crowds || signals.crowds.length === 0)) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">No signals available yet.</p>
      </div>
    );
  }

  const { weather, crowds } = signals;
  const hasWeather = weather && weather.summary && weather.summary !== "No data yet";
  const hasCrowds = crowds && crowds.length > 0;

  return (
    <div className="space-y-4">
      {/* Weather Section */}
      {hasWeather && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold">Weather</h3>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {weather.summary.toLowerCase().includes("rain") || weather.summary.toLowerCase().includes("storm") ? "🌧️" :
                 weather.summary.toLowerCase().includes("cloud") ? "☁️" :
                 weather.summary.toLowerCase().includes("sun") ? "☀️" : "🌤️"}
              </span>
              <span className="text-gray-900">{weather.summary}</span>
            </div>

            {weather.riskHours && weather.riskHours.length > 0 && (
              <div className="mt-2 rounded bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium text-amber-700">Risk Hours:</p>
                <p className="text-sm text-amber-600">{weather.riskHours.join(", ")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Crowd Section */}
      {hasCrowds && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold">Crowd Levels</h3>
          
          <div className="space-y-3">
            {crowds.map((crowd) => {
              const crowdInfo = getCrowdColor(crowd.busyNow);
              return (
                <div key={crowd.placeId} className="flex items-center justify-between rounded border border-gray-100 p-2">
                  <div>
                    <p className="font-medium text-gray-900">{crowd.placeName}</p>
                    {crowd.peakHours && crowd.peakHours.length > 0 && (
                      <p className="text-xs text-gray-500">Peak: {crowd.peakHours.join(", ")}</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 rounded px-2 py-1 ${crowdInfo.bg}`}>
                    <span className={`text-sm font-medium ${crowdInfo.text}`}>{crowd.busyNow}%</span>
                    <span className={`text-xs ${crowdInfo.text}`}>{crowdInfo.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hasWeather && !hasCrowds && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">No signals available yet.</p>
        </div>
      )}
    </div>
  );
}
