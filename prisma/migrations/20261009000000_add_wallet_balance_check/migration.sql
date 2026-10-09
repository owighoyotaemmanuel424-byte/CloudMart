-- Backstop for the wallet debit invariant enforced in src/lib/billing/wallet.ts.
-- NOT VALID so new writes are constrained immediately without failing the deploy
-- on pre-existing negative balances that still need manual reconciliation. Run
-- `ALTER TABLE "Wallet" VALIDATE CONSTRAINT "Wallet_balanceMinor_nonnegative";`
-- once the ledger has been reconciled.
ALTER TABLE "Wallet"
  ADD CONSTRAINT "Wallet_balanceMinor_nonnegative" CHECK ("balanceMinor" >= 0) NOT VALID;
