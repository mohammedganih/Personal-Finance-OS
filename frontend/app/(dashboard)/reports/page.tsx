'use client';

import { FileBarChart2 } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

// Honest placeholder -- no backend data or endpoint exists for standalone
// reports today. Analytics already covers pattern/insight discovery; this
// page exists so the nav item isn't a dead link, not to fake a feature.
export default function ReportsPage() {
  return (
    <PageShell>
      <PageHeader title="Reports" subtitle="Exportable, shareable reports" />
      <EmptyState
        icon={FileBarChart2}
        title="Reports are coming soon"
        description="In the meantime, Analytics has the trends, comparisons, and insights this app can build from real data today."
      />
    </PageShell>
  );
}
