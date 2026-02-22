"use client";

import { useEffect, useState } from "react";
import { getSignals, type SignalsResponse } from "@/api/client";

interface SignalsPanelProps {
  tripId: string;
}

function getCrowdColor(busyNow: number): { bg: string; text: string; label: string } {
  if (busyNow < 40) {
    return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Low" };
  }
  if (busyNow < 70) {
    return { bg: "bg-orange-100", text: "text-orange-700", label: "Medium" };
  }
  return { bg: "bg-rose-100", text: "text-rose-700", label: "High" };
}

function getTransitDelayColor(delayMin: number): { bg: string; text: string } {
  if (delayMin < 5) {
    return { bg: "bg-emerald-100", text: "text-emerald-800" };
  }
  if (delayMin < 10) {
    return { bg: "bg-orange-100", text: "text-orange-800" };
  }
  return { bg: "bg-rose-100", text: "text-rose-800" };
}

export default function SignalsPanel({ tripId }: SignalsPanelProps) {
  const [signals, setSignals] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingStopped, setPollingStopped] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let pollCount = 0;
    const maxPolls = 24;

    async function fetchSignals() {
      try {
        const data = await getSignals(tripId);
        setSignals(data);
        setLoading(false);

        const hasWeatherResponse = data.weather && data.weather.summary;
        const hasCrowdsResponse = data.crowds !== undefined;
        const hasTransitResponse = data.transit !== undefined;

        if (hasWeatherResponse && hasCrowdsResponse && hasTransitResponse) {
          setPollingStopped(true);
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }

        if (!hasWeatherResponse || !hasCrowdsResponse || !hasTransitResponse) {
          intervalId = setInterval(async () => {
            try {
              pollCount++;
              const newData = await getSignals(tripId);
              setSignals(newData);

              const nowHasWeatherResponse = newData.weather && newData.weather.summary;
              const nowHasCrowdsResponse = newData.crowds !== undefined;
              const nowHasTransitResponse = newData.transit !== undefined;

              if ((nowHasWeatherResponse && nowHasCrowdsResponse && nowHasTransitResponse) || pollCount >= maxPolls) {
                setPollingStopped(true);
                if (intervalId) {
                  clearInterval(intervalId);
                  intervalId = null;
                }
              }
            } catch (err) {
              console.error("Error polling signals:", err);
              setPollingStopped(true);
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            }
          }, 5000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load signals");
        setLoading(false);
        setPollingStopped(true);
      }
    }

    fetchSignals();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [tripId]);

  if (loading) {
    return <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4 text-sm text-[#586f62]">Loading signals...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const { weather, crowds, transit, community } = signals || {};
  const hasWeather = weather && weather.summary && weather.summary !== "No data yet";
  const hasCrowds = crowds && crowds.length > 0;
  const hasTransit = transit && transit.alerts && transit.alerts.length > 0;
  const hasCommunity = community && community.reports && community.reports.length > 0;

  const isLoadingWeather = !pollingStopped && (!weather || !weather.summary || weather.summary === "No data yet");
  const isLoadingCrowds = !pollingStopped && crowds === undefined;
  const isLoadingTransit = !pollingStopped && transit === undefined;

  return (
    <div className="space-y-3">
      {hasWeather ? (
        <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4">
          <h3 className="mb-2 text-lg">Weather</h3>
          <p className="text-sm font-semibold text-[#224437]">{weather.summary}</p>
          {weather.riskHours && weather.riskHours.length > 0 && (
            <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
              <p className="text-xs font-semibold text-orange-700">Risk hours</p>
              <p className="text-sm text-orange-700">{weather.riskHours.join(", ")}</p>
            </div>
          )}
        </div>
      ) : isLoadingWeather ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700">Fetching weather forecast...</div>
      ) : null}

      {hasCrowds ? (
        <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4">
          <h3 className="mb-2 text-lg">Crowd Levels</h3>
          <div className="space-y-2">
            {crowds.map((crowd) => {
              const crowdInfo = getCrowdColor(crowd.busyNow);
              return (
                <div key={crowd.placeId} className="rounded-lg border border-[#d7e5dc] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#1d3a2d]">{crowd.placeName}</p>
                      {crowd.peakHours && crowd.peakHours.length > 0 && (
                        <p className="text-xs text-[#60766a]">Peak: {crowd.peakHours.join(", ")}</p>
                      )}
                    </div>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${crowdInfo.bg} ${crowdInfo.text}`}>
                      {crowd.busyNow}% {crowdInfo.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : isLoadingCrowds ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700">Analyzing venue crowd levels...</div>
      ) : crowds && crowds.length === 0 ? (
        <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4 text-sm text-[#576e62]">
          No crowd data available for these venues.
        </div>
      ) : null}

      {hasTransit ? (
        <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4">
          <h3 className="mb-2 text-lg">Transit Alerts</h3>
          <div className="space-y-2">
            {transit.alerts.map((alert, idx) => {
              const delayInfo = getTransitDelayColor(alert.delayMin);
              return (
                <div key={idx} className={`rounded-lg px-3 py-2 ${delayInfo.bg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${delayInfo.text}`}>{alert.line}</p>
                      <p className={`text-xs ${delayInfo.text}`}>{alert.message}</p>
                    </div>
                    <span className={`text-sm font-bold ${delayInfo.text}`}>{alert.delayMin}m</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : isLoadingTransit ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700">Monitoring transit delays...</div>
      ) : transit && transit.alerts && transit.alerts.length === 0 ? (
        <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4 text-sm text-emerald-700">
          No transit delays detected nearby.
        </div>
      ) : pollingStopped && !transit ? (
        <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4 text-sm text-[#576e62]">
          No transit data available for this location.
        </div>
      ) : null}

      {hasCommunity ? (
        <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4">
          <h3 className="mb-2 text-lg">Community Reports</h3>
          <div className="space-y-2">
            {community.reports.map((report) => (
              <div key={report.id} className="rounded-lg border border-[#d8e6dc] bg-[#f8fcfa] p-2">
                <p className="text-sm font-semibold text-[#214236]">
                  {report.type} | severity {report.severity}
                </p>
                <p className="text-xs text-[#567165]">{report.message}</p>
                {report.photoUrl && (
                  <a
                    href={report.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-teal-700 underline"
                  >
                    View photo
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!hasWeather && !hasCrowds && !hasTransit && !hasCommunity && !isLoadingWeather && !isLoadingCrowds && !isLoadingTransit && (
        <div className="rounded-xl border border-[#c7d8cc] bg-white/80 p-4 text-sm text-[#576e62]">No signals available yet.</div>
      )}
    </div>
  );
}
