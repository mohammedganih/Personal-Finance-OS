'use client';

import { UpcomingBillsTable } from '@/components/bills/light/UpcomingBillsTable';
import { SubscriptionsTable } from '@/components/bills/light/SubscriptionsTable';
import { BillsSummaryCard } from '@/components/bills/light/BillsSummaryCard';
import { UpcomingBillsCalendarCard } from '@/components/bills/light/UpcomingBillsCalendarCard';
import { BillInsightsLight } from '@/components/bills/light/BillInsightsLight';

export default function BillsPage() {
  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <UpcomingBillsTable />
          <SubscriptionsTable />
        </div>
        <div className="space-y-4">
          <BillsSummaryCard />
          <UpcomingBillsCalendarCard />
          <BillInsightsLight />
        </div>
      </div>
    </div>
  );
}
