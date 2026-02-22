"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addActivities, createTrip, generateItinerary, type ActivityInput } from "@/api/client";
import PlacePicker from "@/components/PlacePicker";
import { getCityCoordinates } from "@/utils/geocode";

interface LocalActivity {
  provider: string;
  providerPlaceId: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  address?: string;
  durationMin: number;
  locked: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pace, setPace] = useState<"slow" | "medium" | "fast" | "">("");
  const [budget, setBudget] = useState<"low" | "medium" | "high" | "">("");
  const [transportMode, setTransportMode] = useState<"driving" | "walking" | "transit" | "">("");
  const [activities, setActivities] = useState<LocalActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityLocation = useMemo(() => {
    if (!city.trim()) {
      return null;
    }
    return getCityCoordinates(city);
  }, [city]);

  function handleAddPlace(place: LocalActivity) {
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
    if (!pace || !budget) {
      setError("Please select pace and budget preferences.");
      return;
    }
    if (!transportMode) {
      setError("Please select a transportation mode.");
      return;
    }
    if (activities.length === 0) {
      setError("Add at least one activity.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { tripId } = await createTrip({
        city: city.trim(),
        date,
        startTime,
        endTime,
        preferences: {
          pace,
          interests: [],
          avoid: [],
          budget,
        },
      });

      const activityPayload: ActivityInput[] = activities.map((a) => ({
        place: {
          provider: a.provider,
          providerPlaceId: a.providerPlaceId,
          name: a.name,
          lat: a.lat,
          lng: a.lng,
          category: a.category,
          address: a.address,
        },
        durationMin: a.durationMin,
        locked: a.locked,
      }));

      await addActivities(tripId, activityPayload);
      await generateItinerary(tripId, transportMode);
      router.push(`/trip/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 py-6">
      <section className="glass-card overflow-hidden">
        <div className="grid gap-6 p-6 md:grid-cols-[1.25fr_1fr] md:p-8">
          <div>
            <p className="mb-3 inline-flex items-center rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-800">
              Adaptive Planner
            </p>
            <h1 className="text-3xl leading-tight md:text-5xl">Build a smarter one-day itinerary.</h1>
            <p className="mt-3 max-w-xl text-sm text-[#435548] md:text-base">
              Set your day, choose places you care about, and let the planner create a route that adapts to weather,
              crowd levels, and transit changes.
            </p>
          </div>
          <div className="rounded-2xl border border-[#bfd6c7] bg-[#f7fbf8] p-4 text-sm text-[#365044] md:p-5">
            <p className="mb-2 font-semibold">Before generating</p>
            <ul className="space-y-2 text-xs md:text-sm">
              <li>1. Fill trip details and preferences</li>
              <li>2. Add at least one activity with duration</li>
              <li>3. Generate and monitor live updates</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="glass-card space-y-5 p-5 md:p-6">
          <h2 className="text-2xl">Trip Setup</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Paris"
                className="field-control"
              />
            </div>
            <div>
              <label className="field-label">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-control" />
            </div>
            <div>
              <label className="field-label">Transportation</label>
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value as "driving" | "walking" | "transit")}
                className="field-control"
                required
              >
                <option value="">Select mode...</option>
                <option value="driving">Driving</option>
                <option value="walking">Walking</option>
                <option value="transit">Transit</option>
              </select>
            </div>
            <div>
              <label className="field-label">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="field-control"
              />
            </div>
            <div>
              <label className="field-label">End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="field-control" />
            </div>
            <div>
              <label className="field-label">Pace</label>
              <select
                value={pace}
                onChange={(e) => setPace(e.target.value as "slow" | "medium" | "fast")}
                className="field-control"
                required
              >
                <option value="">Select pace...</option>
                <option value="slow">Slow</option>
                <option value="medium">Medium</option>
                <option value="fast">Fast</option>
              </select>
            </div>
            <div>
              <label className="field-label">Budget</label>
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value as "low" | "medium" | "high")}
                className="field-control"
                required
              >
                <option value="">Select budget...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </section>

        <section className="glass-card space-y-5 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">Places</h2>
            <span className="rounded-full border border-[#bed3c5] bg-[#f4faf6] px-3 py-1 text-xs font-semibold text-[#3f5e4f]">
              {activities.length} selected
            </span>
          </div>

          {!city.trim() && (
            <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
              Enter a city first to unlock place search.
            </p>
          )}
          {city && cityLocation && (
            <p className="text-xs text-[#52665a]">
              Searching near {city} ({cityLocation.lat.toFixed(4)}, {cityLocation.lng.toFixed(4)})
            </p>
          )}
          {cityLocation && <PlacePicker onAddPlace={handleAddPlace} defaultLocation={cityLocation} />}

          {activities.length > 0 && (
            <ul className="max-h-[18rem] space-y-2 overflow-auto pr-1">
              {activities.map((a, idx) => (
                <li
                  key={idx}
                  className="flex items-start justify-between gap-2 rounded-xl border border-[#c6d8cc] bg-white/80 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[#1a3628]">{a.name}</p>
                    <p className="mt-1 text-xs text-[#5a6e61]">
                      {a.durationMin} min | {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                    </p>
                    {a.locked && (
                      <span className="mt-1 inline-block rounded bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                        LOCKED
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveActivity(idx)}
                    className="btn-subtle px-3 py-1 text-xs text-red-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="glass-card p-4">
        <button type="button" onClick={handleGenerate} disabled={loading} className="btn-brand w-full px-5 py-3 text-base">
          {loading ? "Generating..." : "Generate Itinerary"}
        </button>
      </div>
    </main>
  );
}
