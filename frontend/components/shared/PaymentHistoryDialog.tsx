'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HistoryType } from '@/hooks/usePaymentHistory';
import { PaymentHistoryList } from '@/components/shared/PaymentHistoryList';

/** The payment history list in a dialog (the ⋯ menu's "Payment history"). */
export function PaymentHistoryDialog({ type, id, name, onClose }: { type: HistoryType; id: string; name: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>History · {name}</DialogTitle></DialogHeader>
        <PaymentHistoryList type={type} id={id} name={name} />
      </DialogContent>
    </Dialog>
  );
}
