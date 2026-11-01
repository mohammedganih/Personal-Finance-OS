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
export function cardEMIAmountInMonth(emi: Installment & { emiAmount: unknown; isArchived: boolean }, card: CardCycle, month: string, currentMonth: string, currentStatus?: string): { amount: number; dueDate: string } | null {
  if (emi.isArchived) return null;
  let next = nextCardEMIDueDate(emi, card, currentMonth);
  if (next && currentStatus === 'PAID' && next.slice(0, 7) === currentMonth) next = dateInMonth(shiftMonth(currentMonth, 1), Number(indiaDateKey(card.dueDate).slice(8)));
  if (!next || month < next.slice(0, 7)) return null;
  const [y, m] = month.split('-').map(Number);
  const [ny, nm] = next.slice(0, 7).split('-').map(Number);
  let offset = (y - ny) * 12 + m - nm;
  // A skipped current installment is deferred, so the final payment moves out.
  if (currentStatus === 'SKIPPED' && next.slice(0, 7) === currentMonth && month > currentMonth) offset--;
  if (offset >= emi.tenureMonths - emi.emisPaid) return null;
  return { amount: Number(emi.emiAmount), dueDate: dateInMonth(month, Number(indiaDateKey(card.dueDate).slice(8))) };
}
