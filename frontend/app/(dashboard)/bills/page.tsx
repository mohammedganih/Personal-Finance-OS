'use client';

import { useState } from 'react';
import { BarChart3, CalendarDays, LayoutGrid, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useBillsSummary } from '@/hooks/useBills';
import { BillsOverviewTab } from '@/components/bills/BillsOverviewTab';
import { BillsCalendarTab } from '@/components/bills/BillsCalendarTab';
import { BillsListTab } from '@/components/bills/BillsListTab';
import { BillsAnalyticsTab } from '@/components/bills/BillsAnalyticsTab';
import { BillForm } from '@/components/bills/BillForm';
import { RecurringBill } from '@/types';

export default function BillsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const { data: summary } = useBillsSummary();

  const openCreate = () => { setEditingBill(null); setShowForm(true); };
  const openEdit = (bill: RecurringBill) => { setEditingBill(bill); setShowForm(true); };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Bills & Commitments</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Every recurring payment — subscriptions, utilities, insurance, rent, fees
            {summary && summary.activeCount > 0 && ` · ${summary.activeCount} active`}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Add Bill
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutGrid className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </TabsTrigger>
          <TabsTrigger value="bills">
            <Receipt className="w-3.5 h-3.5" /> All Bills
            {summary && summary.activeCount > 0 && (
              <span className="ml-1 text-xs bg-bg-overlay px-1.5 py-0.5 rounded-full">{summary.activeCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-3.5 h-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><BillsOverviewTab /></TabsContent>
        <TabsContent value="calendar"><BillsCalendarTab /></TabsContent>
        <TabsContent value="bills"><BillsListTab onEdit={openEdit} onAdd={openCreate} /></TabsContent>
        <TabsContent value="analytics"><BillsAnalyticsTab /></TabsContent>
      </Tabs>

      {showForm && (
        <BillForm
          onClose={() => { setShowForm(false); setEditingBill(null); }}
          bill={editingBill ?? undefined}
        />
      )}
    </div>
  );
}
