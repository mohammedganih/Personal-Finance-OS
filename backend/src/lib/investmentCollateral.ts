import { Prisma } from '@prisma/client';

type Client = Prisma.TransactionClient;

export interface CollateralInput {
  address?: string | null;
  ownershipPercent?: number | null;
  expectedAppreciationRate?: number | null;
}

/**
 * Create, update, or remove the InvestmentCollateral overlay row for one
 * investment. Must run inside the same DB transaction as the entity write.
 * Preserves the pre-extraction per-field partial-update semantics (each of
 * the 3 fields is independently optional) -- only touches fields present in
 * `input`; deletes the row entirely once all 3 end up null.
 */
export async function writeCollateral(tx: Client, investmentId: string, input: CollateralInput): Promise<void> {
  const touched = input.address !== undefined || input.ownershipPercent !== undefined || input.expectedAppreciationRate !== undefined;
  if (!touched) return;

  const existing = await tx.investmentCollateral.findUnique({ where: { investmentId } });
  const next = {
    address: input.address !== undefined ? input.address ?? null : existing?.address ?? null,
    ownershipPercent: input.ownershipPercent !== undefined ? input.ownershipPercent ?? null : existing?.ownershipPercent?.toNumber() ?? null,
    expectedAppreciationRate:
      input.expectedAppreciationRate !== undefined ? input.expectedAppreciationRate ?? null : existing?.expectedAppreciationRate?.toNumber() ?? null,
  };

  if (next.address == null && next.ownershipPercent == null && next.expectedAppreciationRate == null) {
    await tx.investmentCollateral.deleteMany({ where: { investmentId } });
  } else {
    await tx.investmentCollateral.upsert({
      where: { investmentId },
      create: { investmentId, ...next },
      update: next,
    });
  }
}
