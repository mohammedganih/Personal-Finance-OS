/** `YYYY-MM` for a 1-indexed month. */
export function toMonthKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Reads a `?m=YYYY-MM` value; null when it is missing or malformed. */
export function parseMonthParam(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

/** The month before `YYYY-MM`. */
export function previousMonthKey(key: string) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Payments can only be recorded for this month and last month (the API enforces the same rule). */
export function canRecordMonth(key: string, currentKey: string) {
  return key === currentKey || key === previousMonthKey(currentKey);
}
