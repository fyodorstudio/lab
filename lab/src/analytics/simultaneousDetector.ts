import { CalendarRawRow } from '../shared/types.js';

export interface SimultaneousCluster {
  currency: string;
  timestamp: number;
  count: number;
  events: Array<{ eventId: string; valueId: string; countryCode: string; eventName: string }>;
}

/**
 * Groups calendar rows by currency and timestamp to detect simultaneous releases.
 */
export function detectSimultaneousReleases(rows: CalendarRawRow[]): Map<string, SimultaneousCluster> {
  const clusterMap = new Map<string, SimultaneousCluster>();

  for (const row of rows) {
    const key = `${row.currency}_${row.timestamp}`;
    let cluster = clusterMap.get(key);
    if (!cluster) {
      cluster = {
        currency: row.currency,
        timestamp: row.timestamp,
        count: 0,
        events: [],
      };
      clusterMap.set(key, cluster);
    }
    cluster.count++;
    cluster.events.push({
      eventId: row.eventId,
      valueId: row.valueId,
      countryCode: row.countryCode,
      eventName: row.eventName,
    });
  }

  return clusterMap;
}
