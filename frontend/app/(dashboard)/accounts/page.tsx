'use client';

import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { AccountSetup } from '@/components/settings/AccountSetup';

// Promotes Accounts from a tab buried in Settings to its own nav item,
// matching the reference nav -- reuses the existing, fully-functional
// AccountSetup component as-is rather than building a second account list.
export default function AccountsPage() {
  return (
    <PageShell>
      <PageHeader title="Accounts" subtitle="Every bank account, wallet, and card in the household" />
      <AccountSetup />
    </PageShell>
  );
}
