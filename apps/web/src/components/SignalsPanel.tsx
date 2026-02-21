"use client";

import { useEffect, useState } from "react";
import { getSignals, type SignalsResponse } from "@/api/client";

interface SignalsPanelProps {
  tripId: string;
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

  if (!signals?.weather) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">No weather data available yet.</p>
      </div>
    );
  }

  const { weather } = signals;
  const hasRisk = weather.riskHours && weather.riskHours.length > 0;

  return (
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

        {hasRisk && (
          <div className="mt-2 rounded bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium text-amber-700">Risk Hours:</p>
            <p className="text-sm text-amber-600">{weather.riskHours.join(", ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
