import { LedgerType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type WalletMutation = {
  userId: string;
  amountMinor: bigint;
  reference: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

async function creditWalletAs(type: LedgerType, input: WalletMutation) {
  if (input.amountMinor <= 0n) throw new Error("Credit amount must be positive");

  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, balanceMinor: 0n },
      update: {},
    });

    let ledger;
    let created = false;

    try {
      ledger = await tx.ledgerEntry.create({
        data: {
          userId: input.userId,
          walletId: wallet.id,
          type,
          amountMinor: input.amountMinor,
          reference: input.reference,
          description: input.description,
          metadata: input.metadata,
        },
      });
      created = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      ledger = await tx.ledgerEntry.findUnique({ where: { reference: input.reference } });
      if (!ledger) throw error;
    }

    const updated = created
      ? await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceMinor: { increment: input.amountMinor } },
        })
      : wallet;

    return { wallet: updated, ledger };
  });
}

export async function creditWallet(input: WalletMutation) {
  return creditWalletAs(LedgerType.CREDIT, input);
}

export async function debitWallet(input: WalletMutation) {
  if (input.amountMinor <= 0n) throw new Error("Debit amount must be positive");

  return db.$transaction(async (tx) => {
    // Claim the funds with a single conditional write. Reading the balance and
    // checking it in JavaScript before decrementing loses money under
    // concurrency: interactive transactions run at READ COMMITTED, so parallel
    // debits can all pass a check that happened before any of them committed.
    // The conditional update is evaluated by the database against the row as it
    // exists at write time, so only funded debits can ever succeed.
    const claimed = await tx.wallet.updateMany({
      where: { userId: input.userId, balanceMinor: { gte: input.amountMinor } },
      data: { balanceMinor: { decrement: input.amountMinor } },
    });

    if (claimed.count !== 1) {
      const wallet = await tx.wallet.findUnique({
        where: { userId: input.userId },
        select: { id: true },
      });
      if (!wallet) throw new Error("Wallet not found");
      throw new Error("Insufficient wallet balance");
    }

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: input.userId } });

    const ledger = await tx.ledgerEntry.create({
      data: {
        userId: input.userId,
        walletId: wallet.id,
        type: LedgerType.DEBIT,
        amountMinor: input.amountMinor,
        reference: input.reference,
        description: input.description,
        metadata: input.metadata,
      },
    });

    return { wallet, ledger };
  });
}

export async function refundWallet(input: WalletMutation) {
  return creditWalletAs(LedgerType.REFUND, {
    ...input,
    description: input.description || "Order refund",
  });
}
