// Card installments follow statement/payment days, rather than purchase days.
export function indiaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function dateInMonth(month: string, day: number): string {
  const [year, m] = month.split('-').map(Number);
  return `${month}-${String(Math.min(day, new Date(Date.UTC(year, m, 0)).getUTCDate())).padStart(2, '0')}`;
}
type CardCycle = { dueDate: Date; statementDate: Date | null };
type Installment = { startDate: Date; emisPaid: number; tenureMonths: number };
export function firstCardEMIDueDate(emi: Installment, card: CardCycle): string {
  const purchase = indiaDateKey(emi.startDate);
  const dueDay = Number(indiaDateKey(card.dueDate).slice(8));
  let month = purchase.slice(0, 7);
  if (card.statementDate) {
    const statementDay = Number(indiaDateKey(card.statementDate).slice(8));
    if (purchase > dateInMonth(month, statementDay)) month = shiftMonth(month, 1);
    // A due day on/before statement day belongs to the following month.
    if (dueDay <= statementDay) month = shiftMonth(month, 1);
  } else if (purchase > dateInMonth(month, dueDay)) month = shiftMonth(month, 1);
  return dateInMonth(month, dueDay);
}
export function nextCardEMIDueDate(emi: Installment, card: CardCycle, currentMonth: string): string | null {
  if (emi.emisPaid >= emi.tenureMonths) return null;
  const first = firstCardEMIDueDate(emi, card);
  const scheduledMonth = shiftMonth(first.slice(0, 7), emi.emisPaid);
  // Unpaid old installments remain due; don't erase debt just because time passed.
  return dateInMonth(scheduledMonth < currentMonth ? currentMonth : scheduledMonth, Number(indiaDateKey(card.dueDate).slice(8)));
}
