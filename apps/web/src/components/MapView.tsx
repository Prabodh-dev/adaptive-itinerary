"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Itinerary } from "@/api/client";

interface MapViewProps {
  itinerary: Itinerary;
  accessToken?: string;
}

export default function MapView({ itinerary, accessToken }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    if (!mapContainer.current) return;
    if (map.current) return;

    mapboxgl.accessToken = accessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [0, 0],
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!map.current || !accessToken) return;
    if (!itinerary.items.length) return;

    const markers: mapboxgl.Marker[] = [];

    itinerary.items.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = "flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-lg";
      el.textContent = String(idx + 1);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([0, 0])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${item.placeName}</strong><br>${item.startTime} - ${item.endTime}`))
        .addTo(map.current!);

      markers.push(marker);
    });

    if (markers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.forEach((m) => {
        const lngLat = m.getLngLat();
        bounds.extend(lngLat);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [itinerary, accessToken]);

  if (!accessToken) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-500">
        <p>Mapbox token not configured. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local to enable map.</p>
      </div>
    );
  }

  return <div ref={mapContainer} className="h-64 w-full rounded border border-gray-200" />;
}
