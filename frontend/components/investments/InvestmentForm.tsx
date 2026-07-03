'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInMonths, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateInvestment, useUpdateInvestment } from '@/hooks/useInvestments';
import { SplitMemberSelector } from '@/components/shared/MemberSelector';
import { useAccounts } from '@/hooks/useAccounts';
import { Loader2 } from 'lucide-react';
import { ASSET_TYPE_LABELS, FUND_CATEGORIES, INVESTMENT_PLATFORMS } from '@/lib/constants';
import { Investment, AssetType, Account } from '@/types';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// ── Field visibility per asset type ──────────────────────────────────────────
type FieldSet = {
  ticker?: boolean;
  exchange?: boolean;
  quantity: boolean;       // units / grams / installments paid
  buyPrice: boolean;       // avg buy price / NAV / price per gram
  currentPrice: boolean;   // current price / NAV / gold price
  monthlyAmount?: boolean; // SIP / RD / Gold Scheme installment
  fundCategory?: boolean;
  folioNumber?: boolean;
  interestRate?: boolean;
  maturityDate?: boolean;
  maturityAmount?: boolean;
  // Labels override
  quantityLabel?: string;
  buyPriceLabel?: string;
  currentPriceLabel?: string;
};

const FIELD_CONFIG: Record<AssetType, FieldSet> = {
  STOCK: {
    ticker: true, exchange: true,
    quantity: true, buyPrice: true, currentPrice: true,
    quantityLabel: 'Shares',
    buyPriceLabel: 'Buy Price (₹)',
    currentPriceLabel: 'Current Price (₹)',
  },
  ETF: {
    ticker: true, exchange: true,
    quantity: true, buyPrice: true, currentPrice: true,
    quantityLabel: 'Units',
    buyPriceLabel: 'Buy Price (₹)',
    currentPriceLabel: 'Current Price (₹)',
  },
  CRYPTO: {
    ticker: true,
    quantity: true, buyPrice: true, currentPrice: true,
    quantityLabel: 'Coins / Tokens',
    buyPriceLabel: 'Buy Price (₹)',
    currentPriceLabel: 'Current Price (₹)',
  },
  MUTUAL_FUND: {
    quantity: true, buyPrice: true, currentPrice: true,
    folioNumber: true, fundCategory: true,
    quantityLabel: 'Units Held',
    buyPriceLabel: 'Average NAV (₹)',
    currentPriceLabel: 'Current NAV (₹)',
  },
  SIP: {
    quantity: true, buyPrice: true, currentPrice: true,
    monthlyAmount: true, folioNumber: true, fundCategory: true,
    quantityLabel: 'Units Accumulated',
    buyPriceLabel: 'Average NAV (₹)',
    currentPriceLabel: 'Current NAV (₹)',
  },
  FIXED_DEPOSIT: {
    quantity: false, buyPrice: true, currentPrice: false,
    interestRate: true, maturityDate: true, maturityAmount: true,
    buyPriceLabel: 'Principal Amount (₹)',
  },
  RECURRING_DEPOSIT: {
    quantity: true, buyPrice: false, currentPrice: false,
    monthlyAmount: true, interestRate: true,
    maturityDate: true, maturityAmount: true,
    quantityLabel: 'Installments Paid',
  },
  GOLD: {
    quantity: true, buyPrice: true, currentPrice: true,
    quantityLabel: 'Quantity (grams)',
    buyPriceLabel: 'Buy Price per gram (₹)',
    currentPriceLabel: 'Current Price per gram (₹)',
  },
  GOLD_SCHEME: {
    quantity: true, buyPrice: false, currentPrice: true,
    monthlyAmount: true, maturityDate: true, maturityAmount: true,
    quantityLabel: 'Grams Accumulated',
    currentPriceLabel: 'Current Gold Price / gram (₹)',
  },
  REAL_ESTATE: {
    quantity: false, buyPrice: true, currentPrice: true,
    buyPriceLabel: 'Purchase Price (₹)',
    currentPriceLabel: 'Current Market Value (₹)',
  },
  VEHICLE: {
    quantity: false, buyPrice: true, currentPrice: true,
    buyPriceLabel: 'Purchase Price (₹)',
    currentPriceLabel: 'Current Market Value (₹)',
  },
  OTHER: {
    quantity: true, buyPrice: true, currentPrice: true,
  },
};

// ── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  assetName:     z.string().min(1, 'Name required'),
  assetType:     z.enum(Object.keys(ASSET_TYPE_LABELS) as [AssetType, ...AssetType[]]),
  purchaseDate:  z.string().min(1, 'Date required'),
  ticker:        z.string().optional(),
  exchange:      z.string().optional(),
  notes:         z.string().optional(),
  quantity:      z.coerce.number().min(0).optional(),
  buyPrice:      z.coerce.number().min(0).optional(),
  currentPrice:  z.coerce.number().min(0).optional(),
  monthlyAmount: z.coerce.number().positive().optional(),
  fundCategory:  z.string().optional(),
  folioNumber:   z.string().optional(),
  interestRate:  z.coerce.number().min(0).max(100).optional(),
  maturityDate:  z.string().optional(),
  maturityAmount: z.coerce.number().positive().optional(),
  platform:      z.string().optional(),
  bankAccountId: z.string().optional(),
  address:                  z.string().optional(),
  ownershipPercent:         z.coerce.number().min(0).max(100).optional(),
  expectedAppreciationRate: z.coerce.number().min(-100).max(100).optional(),
});

type FormData = z.infer<typeof schema>;

interface InvestmentFormProps {
  onClose: () => void;
  investment?: Investment;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function InvestmentForm({ onClose, investment }: InvestmentFormProps) {
  const isEdit = !!investment;
  const { mutate: create, isPending: isCreating } = useCreateInvestment();
  const { mutate: update, isPending: isUpdating } = useUpdateInvestment();
  const isPending = isCreating || isUpdating;
  const { data: accounts } = useAccounts();

  // Member split state (kept outside react-hook-form for flexibility)
  const [memberId,      setMemberId]      = useState<string | null>(investment?.memberId ?? null);
  const [splitMemberId, setSplitMemberId] = useState<string | null>(investment?.splitMemberId ?? null);
  const [splitRatio,    setSplitRatio]    = useState<number>(investment?.splitRatio ?? 100);

  const defaultType: AssetType = investment?.assetType ?? 'STOCK';

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: investment
      ? {
          assetName:     investment.assetName,
          assetType:     investment.assetType,
          ticker:        investment.ticker ?? '',
          exchange:      investment.exchange ?? '',
          purchaseDate:  format(new Date(investment.purchaseDate), 'yyyy-MM-dd'),
          quantity:      investment.quantity,
          buyPrice:      investment.buyPrice,
          currentPrice:  investment.currentPrice,
          monthlyAmount: investment.monthlyAmount ?? undefined,
          fundCategory:  investment.fundCategory ?? '',
          folioNumber:   investment.folioNumber ?? '',
          interestRate:  investment.interestRate ?? undefined,
          maturityDate:  investment.maturityDate
            ? format(new Date(investment.maturityDate), 'yyyy-MM-dd')
            : undefined,
          maturityAmount: investment.maturityAmount ?? undefined,
          notes:          investment.notes ?? '',
          platform:       investment.platform ?? '',
          address:                  investment.address ?? '',
          ownershipPercent:         investment.ownershipPercent ?? undefined,
          expectedAppreciationRate: investment.expectedAppreciationRate ?? undefined,
        }
      : {
          assetType:    defaultType,
          purchaseDate: format(new Date(), 'yyyy-MM-dd'),
        },
  });

  const selectedType = watch('assetType') as AssetType;
  const cfg = FIELD_CONFIG[selectedType] ?? FIELD_CONFIG.OTHER;
  const isCollateralType = selectedType === 'REAL_ESTATE' || selectedType === 'VEHICLE';

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      memberId:      memberId      || undefined,
      splitMemberId: splitMemberId || undefined,
      splitRatio:    splitMemberId ? splitRatio : undefined,
    } as Record<string, unknown>;
    if (isEdit) {
      update({ id: investment.id, data: payload }, { onSuccess: onClose });
    } else {
      create(payload, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Investment' : 'Add Investment'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Asset type selector */}
          <div className="space-y-1.5">
            <Label>Asset Type</Label>
            <Controller
              name="assetType"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => field.onChange(key)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center',
                        field.value === key
                          ? 'bg-accent-violet/20 text-accent-violet-light border-accent-violet/40'
                          : 'bg-bg-elevated text-text-secondary border-border hover:border-border-strong'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Asset name + date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                {selectedType === 'FIXED_DEPOSIT' || selectedType === 'RECURRING_DEPOSIT'
                  ? 'Bank / Institution'
                  : selectedType === 'GOLD_SCHEME'
                  ? 'Scheme / Jeweller Name'
                  : selectedType === 'REAL_ESTATE'
                  ? 'Property Description'
                  : selectedType === 'VEHICLE'
                  ? 'Vehicle Description'
                  : selectedType === 'SIP' || selectedType === 'MUTUAL_FUND'
                  ? 'Fund Name'
                  : 'Asset Name'}
              </Label>
              <Input placeholder="e.g. SBI Bluechip Fund" {...register('assetName')} />
              {errors.assetName && <p className="text-xs text-danger">{errors.assetName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>
                {selectedType === 'RECURRING_DEPOSIT' || selectedType === 'GOLD_SCHEME' || selectedType === 'SIP'
                  ? 'Start Date'
                  : selectedType === 'FIXED_DEPOSIT'
                  ? 'FD Start Date'
                  : 'Purchase Date'}
              </Label>
              <Input type="date" {...register('purchaseDate')} />
            </div>
          </div>

          {/* Ticker + exchange (stocks, ETF, crypto) */}
          {(cfg.ticker || cfg.exchange) && (
            <div className="grid grid-cols-2 gap-3">
              {cfg.ticker && (
                <div className="space-y-1.5">
                  <Label>Ticker / Symbol</Label>
                  <Input placeholder="e.g. RELIANCE" {...register('ticker')} />
                </div>
              )}
              {cfg.exchange && (
                <div className="space-y-1.5">
                  <Label>Exchange</Label>
                  <Input placeholder="NSE / BSE / Binance" {...register('exchange')} />
                </div>
              )}
            </div>
          )}

          {/* Fund category + folio (SIP / MF) */}
          {(cfg.fundCategory || cfg.folioNumber) && (
            <div className="grid grid-cols-2 gap-3">
              {cfg.fundCategory && (
                <div className="space-y-1.5">
                  <Label>Fund Category</Label>
                  <Controller
                    name="fundCategory"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {FUND_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
              {cfg.folioNumber && (
                <div className="space-y-1.5">
                  <Label>Folio Number</Label>
                  <Input placeholder="12345678" {...register('folioNumber')} />
                </div>
              )}
            </div>
          )}

          {/* Monthly installment (SIP / RD / Gold Scheme) */}
          {cfg.monthlyAmount && (
            <div className="space-y-1.5">
              <Label>
                {selectedType === 'SIP'
                  ? 'Monthly SIP Amount (₹)'
                  : selectedType === 'GOLD_SCHEME'
                  ? 'Monthly Installment (₹)'
                  : 'Monthly Deposit (₹)'}
              </Label>
              <Input
                type="number"
                step="1"
                placeholder={selectedType === 'SIP' ? '5000' : '2000'}
                {...register('monthlyAmount')}
              />
              {errors.monthlyAmount && <p className="text-xs text-danger">{errors.monthlyAmount.message}</p>}
            </div>
          )}

          {/* Price / quantity row */}
          {(cfg.quantity || cfg.buyPrice || cfg.currentPrice) && (
            <div className={cn(
              'grid gap-3',
              [cfg.quantity, cfg.buyPrice, cfg.currentPrice].filter(Boolean).length === 3
                ? 'grid-cols-3'
                : [cfg.quantity, cfg.buyPrice, cfg.currentPrice].filter(Boolean).length === 2
                ? 'grid-cols-2'
                : 'grid-cols-1'
            )}>
              {cfg.quantity && (
                <div className="space-y-1.5">
                  <Label>{cfg.quantityLabel ?? 'Quantity'}</Label>
                  <Input type="number" step="any" placeholder="0" {...register('quantity')} />
                </div>
              )}
              {cfg.buyPrice && (
                <div className="space-y-1.5">
                  <Label>{cfg.buyPriceLabel ?? 'Buy Price (₹)'}</Label>
                  <Input type="number" step="0.01" placeholder="0.00" {...register('buyPrice')} />
                </div>
              )}
              {cfg.currentPrice && (
                <div className="space-y-1.5">
                  <Label>{cfg.currentPriceLabel ?? 'Current Price (₹)'}</Label>
                  <Input type="number" step="0.01" placeholder="0.00" {...register('currentPrice')} />
                </div>
              )}
            </div>
          )}

          {/* Collateral asset fields (Real Estate / Vehicle) -- relevant when a Loan is linked to this asset */}
          {isCollateralType && (
            <div className="space-y-3 p-3 rounded-xl bg-bg-elevated border border-border">
              <div className="space-y-1.5">
                <Label>Address (optional)</Label>
                <Input placeholder="e.g. Plot 12, Green Valley, Pune" {...register('address')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Your Ownership %</Label>
                  <Input type="number" step="0.01" placeholder="100" {...register('ownershipPercent')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Annual Appreciation %</Label>
                  <Input type="number" step="0.1" placeholder="8" {...register('expectedAppreciationRate')} />
                </div>
              </div>
              {isEdit && investment && (investment.linkedLoans?.length ?? 0) > 0 && (
                <p className="text-xs text-text-muted">
                  🔗 Linked to {investment.linkedLoans!.length} loan{investment.linkedLoans!.length > 1 ? 's' : ''}: {investment.linkedLoans!.map((l) => l.name).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Interest rate (RD / FD) */}
          {cfg.interestRate && (
            <div className="space-y-1.5">
              <Label>Interest Rate (% p.a.)</Label>
              <Input type="number" step="0.01" placeholder="7.5" {...register('interestRate')} />
            </div>
          )}

          {/* Maturity date + amount (RD / FD / Gold Scheme) */}
          {(cfg.maturityDate || cfg.maturityAmount) && (
            <div className="grid grid-cols-2 gap-3">
              {cfg.maturityDate && (
                <div className="space-y-1.5">
                  <Label>Maturity Date</Label>
                  <Input type="date" {...register('maturityDate')} />
                </div>
              )}
              {cfg.maturityAmount && (
                <div className="space-y-1.5">
                  <Label>
                    {selectedType === 'GOLD_SCHEME' ? 'Bonus / Maturity Value (₹)' : 'Maturity Amount (₹)'}
                  </Label>
                  <Input type="number" step="1" placeholder="0" {...register('maturityAmount')} />
                </div>
              )}
            </div>
          )}

          {/* Calculated preview for RD / SIP */}
          <RdSipPreview watch={watch} type={selectedType} />

          {/* Who owns / split */}
          <SplitMemberSelector
            memberId={memberId}
            splitMemberId={splitMemberId}
            splitRatio={splitRatio}
            onChange={(mId, smId, ratio) => { setMemberId(mId); setSplitMemberId(smId); setSplitRatio(ratio); }}
            label="Who owns this investment?"
          />

          {/* Bank account link */}
          <div className="space-y-1.5">
            <Label>Linked Bank Account (optional)</Label>
            <Select
              defaultValue={investment?.bankAccountId ?? undefined}
              onValueChange={(v) => setValue('bankAccountId', v)}
            >
              <SelectTrigger><SelectValue placeholder="Which account holds this?" /></SelectTrigger>
              <SelectContent>
                {(accounts as Account[] | undefined)?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Platform + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Platform / App</Label>
              <Controller
                name="platform"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Where did you buy?" /></SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="Any additional details..." {...register('notes')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isEdit ? 'Save Changes' : 'Add Investment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Live preview card for installment-based types ─────────────────────────────

/**
 * RD interest formula: each installment earns interest for a different duration.
 * Deposit 1 earns for `n` months, deposit 2 for `n-1`, ..., deposit n for 1 month.
 * Total months of interest = n*(n+1)/2
 * Interest earned so far = monthly × (rate/100/12) × n*(n+1)/2
 */
function rdInterestEarned(monthly: number, installments: number, annualRate: number): number {
  if (!monthly || !installments || !annualRate) return 0;
  const monthlyRate = annualRate / 100 / 12;
  return monthly * monthlyRate * ((installments * (installments + 1)) / 2);
}

/**
 * Total RD interest over full tenure derived from maturity amount.
 * totalInterest = maturityAmount - (monthly × tenureMonths)
 */
function rdTotalInterest(monthly: number, maturityAmount: number, tenureMonths: number): number {
  if (!monthly || !maturityAmount || !tenureMonths) return 0;
  return maturityAmount - monthly * tenureMonths;
}

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function RdSipPreview({
  watch,
  type,
}: {
  watch: ReturnType<typeof useForm<FormData>>['watch'];
  type: AssetType;
}) {
  const monthly      = Number(watch('monthlyAmount') ?? 0);
  const installments = Number(watch('quantity') ?? 0);
  const rate         = Number(watch('interestRate') ?? 0);
  const maturityAmt  = Number(watch('maturityAmount') ?? 0);
  const currentNav   = Number(watch('currentPrice') ?? 0);
  const units        = Number(watch('quantity') ?? 0);
  const startDate    = watch('purchaseDate') as string;
  const maturityDate = watch('maturityDate') as string;

  // ── Recurring Deposit ──────────────────────────────────────────────────────
  if (type === 'RECURRING_DEPOSIT' && monthly > 0 && installments > 0) {
    const deposited = monthly * installments;

    // Interest earned on what's been deposited so far (RD accrual formula)
    const earnedSoFar = rdInterestEarned(monthly, installments, rate);

    // Total tenure months from start → maturity dates (if both entered)
    let tenureMonths = 0;
    if (startDate && maturityDate) {
      try {
        tenureMonths = differenceInMonths(parseISO(maturityDate), parseISO(startDate));
      } catch { /* ignore parse errors while typing */ }
    }
    const totalInterest = tenureMonths > 0
      ? rdTotalInterest(monthly, maturityAmt, tenureMonths)
      : null;

    return (
      <div className="bg-bg-elevated rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-text-muted">Deposited so far</p>
            <p className="text-sm font-semibold font-mono text-text-primary">{fmt(deposited)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Interest earned so far</p>
            <p className="text-sm font-semibold font-mono text-success">
              {rate > 0 ? fmt(earnedSoFar) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Value so far</p>
            <p className="text-sm font-semibold font-mono text-text-primary">
              {rate > 0 ? fmt(deposited + earnedSoFar) : fmt(deposited)}
            </p>
          </div>
        </div>

        {totalInterest !== null && totalInterest > 0 && (
          <div className="border-t border-border pt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-text-muted">Full tenure deposit</p>
              <p className="text-xs font-mono text-text-secondary">{fmt(monthly * tenureMonths)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Total interest</p>
              <p className="text-xs font-mono text-success">{fmt(totalInterest)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Maturity ({tenureMonths}mo)</p>
              <p className="text-xs font-mono text-text-secondary">{fmt(maturityAmt)}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── SIP ───────────────────────────────────────────────────────────────────
  if (type === 'SIP' && monthly > 0 && units > 0 && currentNav > 0) {
    const currentValue = units * currentNav;

    // Estimate months invested from start date
    let monthsInvested = 0;
    if (startDate) {
      try { monthsInvested = differenceInMonths(new Date(), parseISO(startDate)); } catch { /* */ }
    }
    const totalInvested = monthsInvested > 0 ? monthly * monthsInvested : 0;
    const sipGain       = totalInvested > 0 ? currentValue - totalInvested : 0;

    return (
      <div className="bg-bg-elevated rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-text-muted">Invested so far</p>
          <p className="text-sm font-semibold font-mono text-text-primary">
            {totalInvested > 0 ? fmt(totalInvested) : `${units.toFixed(3)} units`}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Current value</p>
          <p className="text-sm font-semibold font-mono text-text-primary">
            {fmt(currentValue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Gain / Loss</p>
          <p className={`text-sm font-semibold font-mono ${sipGain >= 0 ? 'text-success' : 'text-danger'}`}>
            {totalInvested > 0 ? `${sipGain >= 0 ? '+' : ''}${fmt(sipGain)}` : '—'}
          </p>
        </div>
      </div>
    );
  }

  // ── Gold Scheme ───────────────────────────────────────────────────────────
  if (type === 'GOLD_SCHEME' && monthly > 0) {
    let monthsRunning = 0;
    if (startDate) {
      try { monthsRunning = differenceInMonths(new Date(), parseISO(startDate)); } catch { /* */ }
    }
    const totalPaid = monthsRunning > 0 ? monthly * monthsRunning : 0;

    return (
      <div className="bg-bg-elevated rounded-xl p-3 grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-xs text-text-muted">Total paid so far</p>
          <p className="text-sm font-semibold font-mono text-text-primary">
            {totalPaid > 0 ? fmt(totalPaid) : `${fmt(monthly)}/mo`}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Monthly installment</p>
          <p className="text-sm font-semibold font-mono text-warning">{fmt(monthly)}/mo</p>
        </div>
      </div>
    );
  }

  return null;
}
