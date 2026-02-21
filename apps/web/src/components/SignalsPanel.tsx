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

function getTransitDelayColor(delayMin: number): { bg: string; text: string } {
  if (delayMin < 5) {
    return { bg: "bg-green-100", text: "text-green-700" };
  } else if (delayMin < 10) {
    return { bg: "bg-yellow-100", text: "text-yellow-700" };
  } else {
    return { bg: "bg-red-100", text: "text-red-700" };
  }
}

export default function SignalsPanel({ tripId }: SignalsPanelProps) {
  const [signals, setSignals] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    async function fetchSignals() {
      try {
        const data = await getSignals(tripId);
        setSignals(data);
        setLoading(false);
        
        // If data is still loading, poll frequently
        const hasWeather = data.weather && data.weather.summary && data.weather.summary !== "No data yet";
        const hasCrowds = data.crowds && data.crowds.length > 0;
        const hasTransit = data.transit && data.transit.alerts && data.transit.alerts.length > 0;
        
        // Clear existing interval
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        
        // If still waiting for data, poll every 5 seconds
        if (!hasWeather || !hasCrowds || !hasTransit) {
          intervalId = setInterval(async () => {
            try {
              const newData = await getSignals(tripId);
              setSignals(newData);
              
              // Stop polling once we have all data
              const nowHasWeather = newData.weather && newData.weather.summary && newData.weather.summary !== "No data yet";
              const nowHasCrowds = newData.crowds && newData.crowds.length > 0;
              const nowHasTransit = newData.transit && newData.transit.alerts && newData.transit.alerts.length > 0;
              
              if (nowHasWeather && nowHasCrowds && nowHasTransit && intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            } catch (err) {
              console.error("Error polling signals:", err);
            }
          }, 5000); // Poll every 5 seconds
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load signals");
        setLoading(false);
      }
    }

    fetchSignals();
    
    // Cleanup interval on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
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

  const { weather, crowds, transit } = signals || {};
  const hasWeather = weather && weather.summary && weather.summary !== "No data yet";
  const hasCrowds = crowds && crowds.length > 0;
  const hasTransit = transit && transit.alerts && transit.alerts.length > 0;
  const isLoadingWeather = !weather || !weather.summary || weather.summary === "No data yet";
  const isLoadingCrowds = !crowds || crowds.length === 0;
  const isLoadingTransit = !transit || !transit.alerts || transit.alerts.length === 0;

  return (
    <div className="space-y-4">
      {/* Weather Section */}
      {hasWeather ? (
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
      ) : isLoadingWeather ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            <p className="text-sm text-blue-700">Fetching weather forecast...</p>
          </div>
        </div>
      ) : null}

      {/* Crowd Section */}
      {hasCrowds ? (
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
      ) : isLoadingCrowds ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            <p className="text-sm text-blue-700">Analyzing venue crowd levels...</p>
          </div>
        </div>
      ) : null}

      {/* Transit Section */}
      {hasTransit ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold">Transit Alerts</h3>
          
          <div className="space-y-3">
            {transit.alerts.map((alert, idx) => {
              const delayInfo = getTransitDelayColor(alert.delayMin);
              return (
                <div key={idx} className={`rounded border p-3 ${delayInfo.bg}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🚇</span>
                        <span className={`font-semibold ${delayInfo.text}`}>{alert.line}</span>
                      </div>
                      <p className={`mt-1 text-sm ${delayInfo.text}`}>{alert.message}</p>
                    </div>
                    <div className={`ml-2 flex flex-col items-end`}>
                      <span className={`text-xs font-medium ${delayInfo.text}`}>Delay</span>
                      <span className={`text-lg font-bold ${delayInfo.text}`}>{alert.delayMin}m</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : isLoadingTransit ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            <p className="text-sm text-blue-700">Monitoring transit delays...</p>
          </div>
        </div>
      ) : null}

      {!hasWeather && !hasCrowds && !hasTransit && !isLoadingWeather && !isLoadingCrowds && !isLoadingTransit && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">No signals available yet.</p>
        </div>
      )}
    </div>
  );
}
