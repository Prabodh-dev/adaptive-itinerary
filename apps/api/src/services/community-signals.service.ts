import { db } from "@adaptive/store";
import type { CommunitySignalReport } from "@adaptive/types";
import * as store from "../store/store.js";
import { haversineKm } from "../utils/geo.js";

function getCommunityRadiusMeters(): number {
  return Number.parseInt(process.env.COMMUNITY_SIGNAL_RADIUS_M || "2500", 10);
}

export function getCommunityDefaultTtlMin(): number {
  return Number.parseInt(process.env.COMMUNITY_DEFAULT_TTL_MIN || "120", 10);
}

export function getTripCenter(tripId: string): { lat: number; lng: number } | null {
  const tripData = store.getTrip(tripId);
  if (!tripData) return null;

  const firstActivity = tripData.activities[0];
  if (!firstActivity) return null;

  return {
    lat: firstActivity.place.lat,
    lng: firstActivity.place.lng,
  };
}

function mapReportToCommunitySignal(report: {
  id: string;
  type: string;
  severity: number;
  message: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  expiresAt: Date;
  createdAt: Date;
}): CommunitySignalReport {
  return {
    id: report.id,
    type: report.type,
    severity: report.severity,
    message: report.message,
    lat: report.lat,
    lng: report.lng,
    photoUrl: report.photoUrl ?? undefined,
    expiresAt: report.expiresAt.toISOString(),
    createdAt: report.createdAt.toISOString(),
  };
}

export async function getCommunitySignalsForTrip(tripId: string): Promise<CommunitySignalReport[]> {
  const center = getTripCenter(tripId);
  if (!center) return [];

  const now = new Date();
  const radiusMeters = getCommunityRadiusMeters();
  const reports = await db.report.findMany({
    where: {
      status: "approved",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  return reports
    .filter((report: { lat: number; lng: number }) => {
      const distanceMeters = haversineKm(center.lat, center.lng, report.lat, report.lng) * 1000;
      return distanceMeters <= radiusMeters;
    })
    .map(mapReportToCommunitySignal);
}

export async function getTripsAffectedByReport(report: {
  lat: number;
  lng: number;
}): Promise<string[]> {
  const radiusMeters = getCommunityRadiusMeters();
  const tripIds = store.getTripIds();
  const impacted: string[] = [];

  for (const tripId of tripIds) {
    const center = getTripCenter(tripId);
    if (!center) continue;

    const distanceMeters = haversineKm(center.lat, center.lng, report.lat, report.lng) * 1000;
    if (distanceMeters <= radiusMeters) {
      impacted.push(tripId);
    }
  }

  return impacted;
}

export function computeDefaultReward(severity: number): number {
  if (severity <= 1) return 5;
  if (severity === 2) return 10;
  if (severity === 3) return 20;
  if (severity === 4) return 40;
  return 60;
}
