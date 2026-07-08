/**
 * One-time migration: copies every legacy Subscription row into the new
 * RecurringBill model. Idempotent -- rows already migrated (tracked via the
 * 'migrated:subscription:<id>' tag) are skipped, so it's safe to re-run.
 *
 *   npm run migrate:bills --workspace=backend
 *
 * The legacy `subscriptions` table is left untouched; drop the Subscription
 * model from schema.prisma once you've verified the copy.
 */
import 'dotenv/config';
import { BillFrequency } from '@prisma/client';
import { prisma } from '../lib/prisma';

const CYCLE_TO_FREQUENCY: Record<string, BillFrequency> = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  HALF_YEARLY: 'HALF_YEARLY',
  YEARLY: 'YEARLY',
};

async function main() {
  const subscriptions = await prisma.subscription.findMany();
  console.log(`Found ${subscriptions.length} legacy subscription(s).`);

  let migrated = 0;
  let skipped = 0;

  for (const sub of subscriptions) {
    const marker = `migrated:subscription:${sub.id}`;
    const existing = await prisma.recurringBill.findFirst({
      where: { userId: sub.userId, tags: { has: marker } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.recurringBill.create({
      data: {
        userId: sub.userId,
        memberId: sub.memberId,
        name: sub.serviceName,
        category: sub.category?.trim() || 'Entertainment',
        amount: sub.amount,
        frequency: CYCLE_TO_FREQUENCY[sub.billingCycle] ?? 'MONTHLY',
        // The old model stored the *next* renewal date; using it as the anchor
        // start date preserves the due-day and the upcoming occurrence exactly.
        startDate: sub.renewalDate,
        status: sub.isActive ? 'ACTIVE' : 'ARCHIVED',
        url: sub.url,
        notes: sub.notes,
        tags: [marker],
        createdAt: sub.createdAt,
      },
    });
    migrated++;
  }

  console.log(`Migrated ${migrated}, skipped ${skipped} already-migrated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
