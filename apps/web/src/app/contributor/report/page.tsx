"use client";

import { useEffect, useRef, useState } from "react";
import {
  getContributorReports,
  getContributorRewards,
  registerContributor,
  searchPlaces,
  submitContributorReport,
  type ContributorReport,
  type PlaceSearchResult,
  type RewardLedgerItem,
} from "@/api/client";

const STORAGE_KEY = "adaptive_contributor_id";
const PHOTO_UPLOAD_ENABLED = process.env.NEXT_PUBLIC_ENABLE_REPORT_PHOTO_UPLOAD === "1";

export default function ContributorReportPage() {
  const [contributorId, setContributorId] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  const [type, setType] = useState<"weather" | "traffic" | "transit" | "crowds" | "closure">("traffic");
  const [severity, setSeverity] = useState(3);
  const [message, setMessage] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<PlaceSearchResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [locationText, setLocationText] = useState("");
  const [ttlMin, setTtlMin] = useState("120");
  const [photo, setPhoto] = useState<File | undefined>(undefined);

  const [reports, setReports] = useState<ContributorReport[]>([]);
  const [rewards, setRewards] = useState<RewardLedgerItem[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setContributorId(stored);
      setIsRegistered(true);
      refreshContributorData(stored).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (locationQuery.trim().length < 2) {
      setLocationResults([]);
      setLocationError(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLocationLoading(true);
      setLocationError(null);
      try {
        const near = selectedLocation
          ? { lat: selectedLocation.lat, lng: selectedLocation.lng }
          : { lat: 12.9716, lng: 77.5946 };
        const result = await searchPlaces(locationQuery, near, 15, 8);
        setLocationResults(result.places);
      } catch (error) {
        setLocationResults([]);
        setLocationError(error instanceof Error ? error.message : "Location search failed.");
      } finally {
        setLocationLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [locationQuery, selectedLocation]);

  async function refreshContributorData(id: string) {
    const [reportsRes, rewardsRes] = await Promise.all([
      getContributorReports(id),
      getContributorRewards(id),
    ]);
    setReports(reportsRes.reports);
    setRewards(rewardsRes.rewards);
    setTotalCredits(rewardsRes.totalCredits);
  }

  async function handleRegister() {
    const id = contributorId.trim();
    if (!id) {
      setStatus("Contributor ID is required.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]{4,64}$/.test(id)) {
      setStatus("Contributor ID must be 4-64 chars and only letters, numbers, _ or -.");
      return;
    }
    if (!name.trim()) {
      setStatus("Name is required.");
      return;
    }
    try {
      const res = await registerContributor(id, name.trim(), contact.trim() || undefined);
      setContributorId(id);
      localStorage.setItem(STORAGE_KEY, res.contributorId);
      setIsRegistered(true);
      setStatus("Contributor registered.");
      await refreshContributorData(res.contributorId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Register failed.");
    }
  }

  async function handleSubmitReport() {
    if (!contributorId) {
      setStatus("Register first with a fixed contributor ID.");
      return;
    }
    if (!message.trim()) {
      setStatus("Message is required.");
      return;
    }
    if (!selectedLocation) {
      setStatus("Select location using current location or search.");
      return;
    }

    try {
      await submitContributorReport({
        contributorId,
        type,
        severity,
        message: message.trim(),
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        locationText: locationText.trim() || selectedLocation.label,
        ttlMin: Number.parseInt(ttlMin, 10) || undefined,
        photo: PHOTO_UPLOAD_ENABLED ? photo : undefined,
      });
      setStatus("Report submitted for review.");
      setMessage("");
      setPhoto(undefined);
      setLocationQuery("");
      setLocationResults([]);
      await refreshContributorData(contributorId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Report submission failed.");
    }
  }

  function handleUseCurrentLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSelectedLocation({
          lat,
          lng,
          label: `Current location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        });
        setLocationResults([]);
        setLocationQuery("");
        setStatus("Current location selected.");
      },
      (err) => {
        setLocationError(`Location access failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSelectSearchLocation(place: PlaceSearchResult) {
    setSelectedLocation({
      lat: place.lat,
      lng: place.lng,
      label: place.address ? `${place.name} - ${place.address}` : place.name,
    });
    setLocationResults([]);
    setLocationQuery(place.name);
    setStatus("Search location selected.");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 py-6">
      <section className="glass-card p-6">
        <h1 className="text-3xl">Contributor Signal Report</h1>
        <p className="mt-2 text-sm text-[#51685c]">
          Submit local real-time updates to improve itineraries when APIs miss context.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card space-y-4 p-5">
          <h2 className="text-2xl">Contributor Setup</h2>
          <div>
            <label className="field-label">Contributor ID</label>
            <input
              className="field-control"
              value={contributorId}
              onChange={(e) => setContributorId(e.target.value)}
              disabled={isRegistered}
              placeholder="e.g. chennai_local_01"
            />
            <p className="mt-1 text-xs text-[#5a7165]">
              This ID is permanent after registration and cannot be changed.
            </p>
          </div>
          <div>
            <label className="field-label">Name</label>
            <input className="field-control" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Contact</label>
            <input className="field-control" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          {!isRegistered ? (
            <button className="btn-brand px-4 py-2 text-sm" onClick={handleRegister}>
              Register Contributor
            </button>
          ) : (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              Registered with fixed Contributor ID: {contributorId}
            </p>
          )}
        </section>

        <section className="glass-card space-y-4 p-5">
          <h2 className="text-2xl">New Report</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Type</label>
              <select className="field-control" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="weather">Weather</option>
                <option value="traffic">Traffic</option>
                <option value="transit">Transit</option>
                <option value="crowds">Crowds</option>
                <option value="closure">Closure</option>
              </select>
            </div>
            <div>
              <label className="field-label">Severity (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                className="field-control"
                value={severity}
                onChange={(e) => setSeverity(Math.max(1, Math.min(5, Number.parseInt(e.target.value, 10) || 1)))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Location (required)</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-subtle px-3 py-2 text-xs" onClick={handleUseCurrentLocation}>
                  Use Current Location
                </button>
              </div>
              <input
                className="field-control mt-2"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Search and select a place"
              />
              {locationLoading && <p className="mt-1 text-xs text-[#5a7165]">Searching locations...</p>}
              {locationError && <p className="mt-1 text-xs text-red-600">{locationError}</p>}
              {locationResults.length > 0 && (
                <ul className="mt-2 max-h-44 space-y-1 overflow-auto rounded-lg border border-[#c8d9ce] bg-white p-1">
                  {locationResults.map((place) => (
                    <li key={place.providerPlaceId}>
                      <button
                        type="button"
                        onClick={() => handleSelectSearchLocation(place)}
                        className="w-full rounded px-2 py-1 text-left text-xs hover:bg-[#eef7f2]"
                      >
                        <p className="font-semibold text-[#204135]">{place.name}</p>
                        {place.address && <p className="text-[#5e7669]">{place.address}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedLocation && (
                <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  Selected: {selectedLocation.label}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="field-label">Location Note</label>
            <input className="field-control" value={locationText} onChange={(e) => setLocationText(e.target.value)} />
          </div>
          <div>
            <label className="field-label">TTL (minutes)</label>
            <input className="field-control" value={ttlMin} onChange={(e) => setTtlMin(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Message</label>
            <textarea className="field-control min-h-24" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {PHOTO_UPLOAD_ENABLED ? (
            <div>
              <label className="field-label">Photo (optional)</label>
              <input
                type="file"
                className="field-control"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0])}
              />
            </div>
          ) : (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Photo upload is disabled. Set NEXT_PUBLIC_ENABLE_REPORT_PHOTO_UPLOAD=1 after Cloudinary is configured.
            </p>
          )}
          <button className="btn-brand px-4 py-2 text-sm" onClick={handleSubmitReport}>
            Submit for Review
          </button>
        </section>
      </div>

      {status && <p className="glass-card p-3 text-sm text-[#355545]">{status}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl">My Reports</h3>
            <button
              className="btn-subtle px-3 py-1 text-xs"
              onClick={() => contributorId && refreshContributorData(contributorId)}
            >
              Refresh
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {reports.map((report) => (
              <li key={report.id} className="rounded-xl border border-[#cadacb] bg-white/80 p-3">
                <p className="font-semibold">{report.type} | severity {report.severity}</p>
                <p className="text-xs text-[#587165]">{report.message}</p>
                <p className="mt-1 text-xs">Status: {report.status}</p>
              </li>
            ))}
            {reports.length === 0 && <li className="text-sm text-[#5a7165]">No reports yet.</li>}
          </ul>
        </section>

        <section className="glass-card p-5">
          <h3 className="text-2xl">Rewards</h3>
          <p className="mt-2 text-sm font-semibold text-[#264e3b]">Total Credits: {totalCredits}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {rewards.map((reward) => (
              <li key={reward.id} className="rounded-xl border border-[#cadacb] bg-white/80 p-3">
                <p className="font-semibold">{reward.amount} credits</p>
                <p className="text-xs text-[#587165]">Status: {reward.status}</p>
              </li>
            ))}
            {rewards.length === 0 && <li className="text-sm text-[#5a7165]">No rewards yet.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
