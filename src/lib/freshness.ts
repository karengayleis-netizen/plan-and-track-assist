const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the number of full days since the given date.
 */
export function daysAgo(date: Date | undefined | null): number | null {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

/**
 * Returns a human-readable freshness label.
 */
export function freshnessLabel(date: Date | undefined | null): string {
  const days = daysAgo(date);
  if (days === null) return 'No data';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/**
 * Whether data is considered stale (>30 days old).
 */
export function isStale(date: Date | undefined | null, thresholdDays = 30): boolean {
  const days = daysAgo(date);
  return days === null || days > thresholdDays;
}
