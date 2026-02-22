"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getTrip, type GetTripResponse } from "@/api/client";
import MapView from "@/components/MapView";
import SignalsPanel from "@/components/SignalsPanel";
import SuggestionCard from "@/components/SuggestionCard";
import Timeline from "@/components/Timeline";
import { useTripStream } from "@/hooks/useTripStream";

export default function TripDashboardPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;
  const [data, setData] = useState<GetTripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestionsKey, setSuggestionsKey] = useState(0);

  const refreshTrip = useCallback(() => {
    if (!tripId) return;
    getTrip(tripId)
      .then(setData)
      .catch((err) => console.error("Failed to refresh trip:", err));
  }, [tripId]);

  useTripStream({
    tripId: tripId as string,
    onSignalUpdate: () => {
      console.log("Signal update received via SSE");
    },
    onSuggestionNew: () => {
      setSuggestionsKey((k) => k + 1);
    },
    onItineraryVersion: () => {
      refreshTrip();
    },
  });

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    getTrip(tripId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trip."))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl py-8">
        <div className="glass-card p-5 text-sm text-[#516359]">Loading trip...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl py-8">
        <div className="glass-card p-5 text-sm text-[#516359]">No trip data found.</div>
      </main>
    );
  }

  const trip = data.trip as Record<string, unknown>;
  const cityStr = typeof trip.city === "string" ? trip.city : "";
  const dateStr = typeof trip.date === "string" ? trip.date : "";
  const startStr = typeof trip.startTime === "string" ? trip.startTime : "";
  const endStr = typeof trip.endTime === "string" ? trip.endTime : "";

  return (
    <main className="mx-auto max-w-7xl space-y-6 py-6">
      <section className="glass-card overflow-hidden">
        <div className="grid gap-4 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-7">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4a6656]">Trip Dashboard</p>
            <h1 className="text-3xl md:text-4xl">{cityStr || "Your Trip"}</h1>
            <p className="mt-2 text-sm text-[#4e6559]">Live planning with signals, suggestions, and itinerary updates.</p>
          </div>
          <div className="rounded-2xl border border-[#c8d9ce] bg-[#f5faf7] p-4">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {dateStr && (
                <>
                  <dt className="text-[#5d7266]">Date</dt>
                  <dd className="font-semibold">{dateStr}</dd>
                </>
              )}
              {startStr && (
                <>
                  <dt className="text-[#5d7266]">Start</dt>
                  <dd className="font-semibold">{startStr}</dd>
                </>
              )}
              {endStr && (
                <>
                  <dt className="text-[#5d7266]">End</dt>
                  <dd className="font-semibold">{endStr}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </section>

      <section className="glass-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl">Contribute Live Intelligence</h2>
            <p className="text-sm text-[#4f6559]">
              Help improve live reroutes with verified local reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/contributor/report" className="btn-subtle px-3 py-2 text-xs">
              Contributor Portal
            </Link>
            <Link href="/admin/reports" className="btn-subtle px-3 py-2 text-xs">
              Admin Review
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6">
          <div className="glass-card p-5">
            <h2 className="mb-3 text-2xl">Itinerary</h2>
            {data.latestItinerary ? (
              <Timeline itinerary={data.latestItinerary.itinerary} version={data.latestItinerary.version} />
            ) : (
              <p className="text-sm text-[#62776b]">No itinerary generated yet.</p>
            )}
          </div>

          <div className="glass-card p-5">
            <h2 className="mb-3 text-2xl">Map</h2>
            {data.activities && data.activities.length > 0 ? (
              <MapView activities={data.activities} accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
            ) : (
              <p className="text-sm text-[#62776b]">Add activities to see them on the map.</p>
            )}
          </div>

          {data.activities && data.activities.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="mb-3 text-2xl">Activities</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.activities.map((a, idx) => (
                  <li key={idx} className="rounded-xl border border-[#cadacc] bg-white/80 p-3 text-sm">
                    <p className="font-semibold text-[#183428]">{a.place.name}</p>
                    <p className="text-xs text-[#5f7468]">{a.durationMin} min</p>
                    {a.locked && (
                      <span className="mt-1 inline-block rounded bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                        LOCKED
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="space-y-6 xl:sticky xl:top-5 xl:h-fit">
          {tripId && (
            <div className="glass-card p-5">
              <h2 className="mb-3 text-2xl">Signals</h2>
              <SignalsPanel tripId={tripId as string} />
            </div>
          )}
          {tripId && (
            <div className="glass-card p-5">
              <SuggestionCard key={suggestionsKey} tripId={tripId as string} onSuggestionApplied={refreshTrip} />
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
