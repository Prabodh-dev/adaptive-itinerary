"use client";

import { useState, useEffect, useRef } from "react";
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

  // Update search location when defaultLocation prop changes
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
      alert("Please enter a valid duration (minimum 1 minute)");
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
    // Don't reset duration - keep user's preference
    setSelectedLocked(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-end gap-2 mb-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">Search Location (lat, lng)</label>
          <input
            type="text"
            value={`${searchLocation.lat}, ${searchLocation.lng}`}
            onChange={(e) => {
              const parts = e.target.value.split(",").map((s) => parseFloat(s.trim()));
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                setSearchLocation({ lat: parts[0], lng: parts[1] });
              }
            }}
            placeholder="e.g. 13.08, 80.27"
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-gray-600">Radius (km)</label>
          <select 
            value={searchRadius} 
            onChange={(e) => setSearchRadius(parseInt(e.target.value))}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="20">20 km</option>
            <option value="50">50 km</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">Duration (minutes) *</label>
          <input
            type="number"
            value={selectedDuration}
            onChange={(e) => setSelectedDuration(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 0))}
            placeholder="e.g. 60, 90, 120"
            min="1"
            step="15"
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            required
          />
        </div>
        <div className="flex items-center pt-5">
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedLocked}
              onChange={(e) => setSelectedLocked(e.target.checked)}
              className="rounded"
            />
            Lock time
          </label>
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search for places (e.g. museum, restaurant)"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching...</span>
        )}
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
          {results.map((place) => (
            <li key={place.providerPlaceId}>
              <button
                type="button"
                onClick={() => handleSelectPlace(place)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <div className="font-medium text-gray-900">{place.name}</div>
                <div className="text-xs text-gray-500">{place.category}</div>
                {place.address && <div className="text-xs text-gray-400 truncate">{place.address}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showResults && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
          No places found
        </div>
      )}
    </div>
  );
}
