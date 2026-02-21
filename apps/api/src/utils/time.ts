/**
 * Time utility functions for handling HH:mm time strings and minute conversions
 */

/**
 * Parse a time string in HH:mm format to minutes from midnight
 * @param timeStr - Time string in HH:mm format (e.g., "09:30")
 * @returns Minutes from midnight (0-1439)
 */
export function parseHHMM(timeStr: string): number {
  const [hoursStr, minutesStr] = timeStr.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  return hours * 60 + minutes;
}

/**
 * Format minutes from midnight to HH:mm string
 * @param minutes - Minutes from midnight
 * @returns Time string in HH:mm format
 */
export function formatHHMM(minutes: number): string {
  const clamped = clamp(minutes, 0, 1439);
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
