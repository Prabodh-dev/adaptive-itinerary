"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTrip, type GetTripResponse } from "@/api/client";
import Timeline from "@/components/Timeline";
import MapView from "@/components/MapView";

export default function TripDashboardPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;
  const [data, setData] = useState<GetTripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    getTrip(tripId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trip."))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-10"><p className="text-gray-500">Loading trip...</p></main>;
  if (error) return <main className="mx-auto max-w-2xl px-4 py-10"><p className="text-red-600">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-2xl px-4 py-10"><p className="text-gray-500">No trip data found.</p></main>;

  const trip = data.trip as Record<string, unknown>;
  const cityStr = typeof trip.city === "string" ? trip.city : "";
  const dateStr = typeof trip.date === "string" ? trip.date : "";
  const startStr = typeof trip.startTime === "string" ? trip.startTime : "";
  const endStr = typeof trip.endTime === "string" ? trip.endTime : "";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Trip Dashboard</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {cityStr && (<><dt className="font-medium text-gray-500">City</dt><dd>{cityStr}</dd></>)}
          {dateStr && (<><dt className="font-medium text-gray-500">Date</dt><dd>{dateStr}</dd></>)}
          {startStr && (<><dt className="font-medium text-gray-500">Start</dt><dd>{startStr}</dd></>)}
          {endStr && (<><dt className="font-medium text-gray-500">End</dt><dd>{endStr}</dd></>)}
        </dl>
      </section>

      {data.activities && data.activities.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Activities</h2>
          <ul className="space-y-1 text-sm">
            {data.activities.map((a, idx) => (
              <li key={idx}>{a.place.name} — {a.durationMin} min {a.locked && <span className="ml-2 text-xs text-amber-600 font-medium">LOCKED</span>}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Itinerary</h2>
        {data.itinerary ? <Timeline itinerary={data.itinerary} /> : <p className="text-gray-500 text-sm">No itinerary generated yet.</p>}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Map</h2>
        {data.itinerary ? (
          <MapView itinerary={data.itinerary} accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
        ) : (
          <p className="text-gray-500 text-sm">Generate an itinerary to see the map.</p>
        )}
      </section>
    </main>
  );
}
