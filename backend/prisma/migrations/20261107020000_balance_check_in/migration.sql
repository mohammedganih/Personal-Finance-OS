-- Last balance check-in on Net worth (even when every balance matched).
ALTER TABLE "user_settings" ADD COLUMN "balancesCheckedAt" TIMESTAMP(3);
