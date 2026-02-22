"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { ActivityInput } from "@/api/client";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface MapViewProps {
  activities: ActivityInput[];
  accessToken?: string;
}

export default function MapView({ activities, accessToken }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersAdded = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    if (!mapContainer.current) return;
    if (map.current) return;

    mapboxgl.accessToken = accessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [0, 0],
      zoom: 2,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      map.current?.remove();
      map.current = null;
      markersAdded.current = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!map.current || !accessToken) return;
    if (!activities.length) return;

    const existingMarkers = document.querySelectorAll(".mapboxgl-marker");
    existingMarkers.forEach((el) => el.remove());

    const validActivities = activities.filter((a) => a.place.lat !== 0 && a.place.lng !== 0);
    
    if (validActivities.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    validActivities.forEach((activity, idx) => {
      const el = document.createElement("div");
      el.className = "flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-lg";
      el.textContent = String(idx + 1);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([activity.place.lng, activity.place.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${activity.place.name}</strong>`))
        .addTo(map.current!);

      bounds.extend([activity.place.lng, activity.place.lat]);
    });

    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [activities, accessToken]);

  if (!accessToken) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-xl border border-[#c7d8cc] bg-[#f7fbf8] p-4 text-center text-sm text-[#5a7064]">
        Mapbox token not configured. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local to enable map.
      </div>
    );
  }

  return <div ref={mapContainer} className="h-72 w-full overflow-hidden rounded-xl border border-[#c7d8cc]" />;
}
