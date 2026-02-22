"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces, type PlaceSearchResult } from "@/api/client";

interface PlacePickerProps {
  onAddPlace: (place: {
    provider: string;
    providerPlaceId: string;
    name: string;
    lat: number;
    lng: number;
    category?: string;
    address?: string;
    durationMin: number;
    locked: boolean;
  }) => void;
  defaultLocation: { lat: number; lng: number };
}

export default function PlacePicker({ onAddPlace, defaultLocation }: PlacePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | "">("");
  const [selectedLocked, setSelectedLocked] = useState(false);
  const [searchRadius, setSearchRadius] = useState(10);
  const [searchLocation, setSearchLocation] = useState(defaultLocation);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchLocation(defaultLocation);
  }, [defaultLocation]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPlaces(query, searchLocation, searchRadius, 20);
        setResults(res.places);
        setShowResults(true);
      } catch (err) {
        console.error("Search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchLocation, searchRadius]);

  function handleSelectPlace(place: PlaceSearchResult) {
    if (!selectedDuration || selectedDuration < 1) {
      alert("Please enter a valid duration (minimum 1 minute).");
      return;
    }

    onAddPlace({
      provider: place.provider,
      providerPlaceId: place.providerPlaceId,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      category: place.category,
      address: place.address,
      durationMin: selectedDuration,
      locked: selectedLocked,
    });

    setQuery("");
    setResults([]);
    setShowResults(false);
    setSelectedLocked(false);
  }

  return (
    <div ref={containerRef} className="relative space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="field-label">Search Location (lat, lng)</label>
          <input
            type="text"
            value={`${searchLocation.lat}, ${searchLocation.lng}`}
            onChange={(e) => {
              const parts = e.target.value.split(",").map((s) => parseFloat(s.trim()));
              if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
                setSearchLocation({ lat: parts[0], lng: parts[1] });
              }
            }}
            placeholder="e.g. 13.08, 80.27"
            className="field-control"
          />
        </div>
        <div className="sm:w-36">
          <label className="field-label">Radius</label>
          <select value={searchRadius} onChange={(e) => setSearchRadius(parseInt(e.target.value, 10))} className="field-control">
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="20">20 km</option>
            <option value="50">50 km</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="field-label">Duration (minutes)</label>
          <input
            type="number"
            value={selectedDuration}
            onChange={(e) => setSelectedDuration(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value, 10) || 0))}
            min="1"
            step="15"
            placeholder="e.g. 60"
            className="field-control"
            required
          />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-[#c7d8cc] bg-[#f6fbf8] px-3 py-2 text-sm font-medium text-[#3e564a]">
          <input type="checkbox" checked={selectedLocked} onChange={(e) => setSelectedLocked(e.target.checked)} className="rounded" />
          Lock time
        </label>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search places (museum, cafe, park...)"
          className="field-control pr-24"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#4f6559]">Searching...</span>
        )}
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-[#c4d6ca] bg-white p-1 shadow-xl">
          {results.map((place) => (
            <li key={place.providerPlaceId}>
              <button
                type="button"
                onClick={() => handleSelectPlace(place)}
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-[#eef7f2]"
              >
                <div className="text-sm font-semibold text-[#173428]">{place.name}</div>
                <div className="text-xs text-[#5c7467]">{place.category || "General"}</div>
                {place.address && <div className="truncate text-xs text-[#7a8f84]">{place.address}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showResults && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-[#c4d6ca] bg-white px-3 py-2 text-sm text-[#52675b]">
          No places found.
        </div>
      )}
    </div>
  );
}
