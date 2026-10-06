CREATE TABLE "WalletDeposit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentProvider" TEXT,
  "providerReference" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletDeposit_reference_key" ON "WalletDeposit"("reference");
CREATE INDEX "WalletDeposit_userId_createdAt_idx" ON "WalletDeposit"("userId", "createdAt");
CREATE INDEX "WalletDeposit_status_createdAt_idx" ON "WalletDeposit"("status", "createdAt");

ALTER TABLE "WalletDeposit"
  ADD CONSTRAINT "WalletDeposit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;