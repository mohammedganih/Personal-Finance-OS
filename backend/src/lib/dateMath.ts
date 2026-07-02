/**
 * Adds `months` to `date`, then clamps the resulting day-of-month to
 * `anchorDay` (capped at that month's last day). Used to project recurring
 * monthly due-dates/debits from a single anchor day without JS Date's
 * default day-overflow rollover (e.g. Jan 31 + 1 month silently becoming
 * Mar 3 instead of Feb 28).
 */
export function addMonthsClamped(date: Date, months: number, anchorDay: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(anchorDay, daysInMonth));
  return d;
}
