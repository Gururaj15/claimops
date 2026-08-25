/**
 * SQLite's datetime('now') default produces "2026-08-25 00:49:53" (space
 * separator, no timezone). But scripts/seed.ts backdates some timestamps by
 * writing full ISO strings ("2026-08-23T17:39:22.000Z") directly. Naively
 * doing `ts.replace(" ", "T") + "Z"` works for the first format and
 * silently produces an invalid, NaN-yielding date for the second (double
 * "Z"). Found via manual API testing (dashboard's avgCycleDays came back
 * `null`) — this function is the fix, used everywhere a stored timestamp
 * gets parsed instead of repeating the buggy inline pattern.
 */
export function parseDbTimestamp(ts: string): Date {
  if (ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts)) {
    return new Date(ts);
  }
  return new Date(ts.replace(" ", "T") + "Z");
}
