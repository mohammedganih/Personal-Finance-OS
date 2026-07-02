/**
 * Resolves a target month/year (1-indexed month, matching what the API and
 * frontend use) into a JS Date range covering that whole calendar month.
 * Defaults to the current month when either is omitted, so every existing
 * caller that doesn't pass a period keeps showing "this month" unchanged.
 */
export function resolveMonthRange(month?: number, year?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = (month ?? now.getMonth() + 1) - 1; // to 0-indexed
  return {
    start: new Date(y, m, 1),
    end: new Date(y, m + 1, 0, 23, 59, 59),
  };
}
