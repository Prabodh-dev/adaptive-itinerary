/**
 * GTFS-Realtime parser for transit delays and service alerts
 */
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

export interface TransitAlert {
  line: string;
  delayMin: number;
  message: string;
}

/**
 * Fetch and parse GTFS-Realtime feed
 */
export async function fetchGtfsRt(
  url: string,
  timeout = 10000
): Promise<GtfsRealtimeBindings.transit_realtime.FeedMessage | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      console.error(`[GTFS-RT] Feed fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    return feed;
  } catch (error) {
    console.error(`[GTFS-RT] Error fetching feed from ${url}:`, error);
    return null;
  }
}

/**
 * Extract alerts from GTFS-RT feed
 * Note: Alerts often don't include numeric delay values
 */
export function extractAlerts(
  feedMessage: GtfsRealtimeBindings.transit_realtime.FeedMessage
): TransitAlert[] {
  const alerts: TransitAlert[] = [];

  for (const entity of feedMessage.entity) {
    if (!entity.alert) continue;

    const alert = entity.alert;

    // Extract route/line from informed entities
    let line = "Transit";
    if (alert.informedEntity && alert.informedEntity.length > 0) {
      const firstEntity = alert.informedEntity[0];
      if (firstEntity.routeId) {
        line = firstEntity.routeId;
      }
    }

    // Extract message from header or description
    let message = "Service alert";
    if (alert.headerText && alert.headerText.translation && alert.headerText.translation.length > 0) {
      message = alert.headerText.translation[0].text || message;
    } else if (
      alert.descriptionText &&
      alert.descriptionText.translation &&
      alert.descriptionText.translation.length > 0
    ) {
      message = alert.descriptionText.translation[0].text || message;
    }

    // Alerts typically don't have numeric delay - set to 0 or infer from severity
    let delayMin = 0;
    
    // Try to infer delay from effect if available
    if (alert.effect) {
      switch (alert.effect) {
        case GtfsRealtimeBindings.transit_realtime.Alert.Effect.SIGNIFICANT_DELAYS:
          delayMin = 15; // Assume significant = 15 min
          break;
        case GtfsRealtimeBindings.transit_realtime.Alert.Effect.REDUCED_SERVICE:
          delayMin = 10;
          break;
        case GtfsRealtimeBindings.transit_realtime.Alert.Effect.DETOUR:
        case GtfsRealtimeBindings.transit_realtime.Alert.Effect.ADDITIONAL_SERVICE:
          delayMin = 5;
          break;
        default:
          delayMin = 0;
      }
    }

    alerts.push({
      line,
      delayMin,
      message: message.substring(0, 200), // Truncate long messages
    });
  }

  return alerts;
}

/**
 * Extract trip update delays from GTFS-RT feed
 */
export function extractTripUpdateDelays(
  feedMessage: GtfsRealtimeBindings.transit_realtime.FeedMessage
): TransitAlert[] {
  const alerts: TransitAlert[] = [];

  for (const entity of feedMessage.entity) {
    if (!entity.tripUpdate) continue;

    const tripUpdate = entity.tripUpdate;

    // Extract route/line
    let line = "Transit";
    if (tripUpdate.trip && tripUpdate.trip.routeId) {
      line = tripUpdate.trip.routeId;
    }

    // Find worst delay from stop time updates
    let maxDelaySeconds = 0;

    if (tripUpdate.stopTimeUpdate) {
      for (const stopUpdate of tripUpdate.stopTimeUpdate) {
        // Check arrival delay
        if (stopUpdate.arrival && stopUpdate.arrival.delay != null) {
          maxDelaySeconds = Math.max(maxDelaySeconds, Math.abs(stopUpdate.arrival.delay));
        }

        // Check departure delay
        if (stopUpdate.departure && stopUpdate.departure.delay != null) {
          maxDelaySeconds = Math.max(maxDelaySeconds, Math.abs(stopUpdate.departure.delay));
        }
      }
    }

    // Convert seconds to minutes and cap at reasonable limit
    const delayMin = Math.min(Math.ceil(maxDelaySeconds / 60), 120); // Cap at 2 hours

    // Only include if there's actual delay
    if (delayMin > 0) {
      alerts.push({
        line,
        delayMin,
        message: `Trip delayed by ${delayMin} minutes`,
      });
    }
  }

  return alerts;
}

/**
 * Merge and deduplicate alerts by line
 * Keep alerts with highest delay per line, limit to top N
 */
export function mergeAlerts(alerts: TransitAlert[], maxAlerts = 5): TransitAlert[] {
  // Group by line, keep highest delay
  const byLine = new Map<string, TransitAlert>();

  for (const alert of alerts) {
    const existing = byLine.get(alert.line);
    if (!existing || alert.delayMin > existing.delayMin) {
      byLine.set(alert.line, alert);
    }
  }

  // Sort by delay (highest first) and limit
  return Array.from(byLine.values())
    .sort((a, b) => b.delayMin - a.delayMin)
    .slice(0, maxAlerts);
}
