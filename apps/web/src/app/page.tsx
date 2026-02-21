"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createTrip, addActivities, generateItinerary, type ActivityInput } from "@/api/client";
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
  const [interests, setInterests] = useState<string>("");
  const [avoid, setAvoid] = useState<string>("");
  const [transportMode, setTransportMode] = useState<"driving" | "walking" | "transit" | "">("");
  const [activities, setActivities] = useState<LocalActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get city coordinates based on entered city name
  const cityLocation = useMemo(() => {
    if (!city.trim()) {
      return null; // No default - user must enter a city
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
      // Create trip with user-selected preferences
      const { tripId } = await createTrip({
        city: city.trim(),
        date,
        startTime,
        endTime,
        preferences: {
          pace,
          interests: interests ? interests.split(",").map(s => s.trim()).filter(Boolean) : [],
          avoid: avoid ? avoid.split(",").map(s => s.trim()).filter(Boolean) : [],
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
        <h2 className="text-lg font-semibold">Preferences</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Pace *</label>
            <select value={pace} onChange={(e) => setPace(e.target.value as "slow" | "medium" | "fast")} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required>
              <option value="">Select pace...</option>
              <option value="slow">Slow (Relaxed, more time per place)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="fast">Fast (Energetic, quick visits)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Budget *</label>
            <select value={budget} onChange={(e) => setBudget(e.target.value as "low" | "medium" | "high")} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required>
              <option value="">Select budget...</option>
              <option value="low">Low (Budget-friendly)</option>
              <option value="medium">Medium (Moderate spending)</option>
              <option value="high">High (Premium experiences)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Interests (optional)</label>
          <input type="text" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="e.g. history, art, food, nature (comma-separated)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Avoid (optional)</label>
          <input type="text" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="e.g. crowds, heights, spicy food (comma-separated)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Transportation Mode *</label>
          <select value={transportMode} onChange={(e) => setTransportMode(e.target.value as "driving" | "walking" | "transit")} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required>
            <option value="">Select mode...</option>
            <option value="driving">Driving (Car/Taxi)</option>
            <option value="walking">Walking</option>
            <option value="transit">Public Transit</option>
          </select>
        </div>
      </section>

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold">Search Places</h2>
        {!city.trim() && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Please enter a city above to start searching for places.
          </p>
        )}
        {city && cityLocation && (
          <p className="text-xs text-gray-500">
            Searching near {city} ({cityLocation.lat.toFixed(4)}, {cityLocation.lng.toFixed(4)})
          </p>
        )}
        {cityLocation && <PlacePicker onAddPlace={handleAddPlace} defaultLocation={cityLocation} />}

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
