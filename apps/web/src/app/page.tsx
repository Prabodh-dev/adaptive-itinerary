"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTrip, addActivities, generateItinerary, type ActivityInput } from "@/api/client";
import PlacePicker from "@/components/PlacePicker";

interface LocalActivity {
  name: string;
  lat: number;
  lng: number;
  durationMin: number;
  locked: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [activities, setActivities] = useState<LocalActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddPlace(place: { name: string; lat: number; lng: number; durationMin: number; locked: boolean }) {
    setActivities((prev) => [...prev, place]);
  }

  function handleRemoveActivity(index: number) {
    setActivities((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGenerate() {
    if (!city.trim() || !date || !startTime || !endTime) {
      setError("Please fill in all trip details.");
      return;
    }
    if (activities.length === 0) {
      setError("Add at least one activity.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { tripId } = await createTrip({ city: city.trim(), date, startTime, endTime, preferences: {} });
      const activityPayload: ActivityInput[] = activities.map((a) => ({
        place: { name: a.name, lat: a.lat, lng: a.lng },
        durationMin: a.durationMin,
        locked: a.locked,
      }));
      await addActivities(tripId, activityPayload);
      await generateItinerary(tripId);
      router.push(`/trip/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold">Create Trip</h1>

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold">Trip Details</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">City</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Paris" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Start Time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">End Time</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
      </section>

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold">Search Places</h2>
        <PlacePicker onAddPlace={handleAddPlace} />

        {activities.length > 0 && (
          <ul className="space-y-2">
            {activities.map((a, idx) => (
              <li key={idx} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                <span>
                  {a.name} — {a.durationMin} min {a.locked && <span className="ml-2 text-xs text-amber-600 font-medium">LOCKED</span>}
                  <span className="ml-2 text-xs text-gray-400">({a.lat.toFixed(4)}, {a.lng.toFixed(4)})</span>
                </span>
                <button type="button" onClick={() => handleRemoveActivity(idx)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <button type="button" onClick={handleGenerate} disabled={loading} className="w-full rounded bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50">
        {loading ? "Generating..." : "Generate Itinerary"}
      </button>
    </main>
  );
}
