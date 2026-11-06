'use client';

import { MonthSheet } from '@/components/dashboard/home/MonthSheet';
import { StillToPay } from '@/components/dashboard/home/StillToPay';
import { WealthStrip } from '@/components/dashboard/home/WealthStrip';

// Home: the family's month on one sheet (salary in, commitments out, what's
// left), then what is still to pay and a compact wealth strip.
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <MonthSheet />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2"><StillToPay /></div>
        <WealthStrip />
      </div>
    </div>
  );
}
