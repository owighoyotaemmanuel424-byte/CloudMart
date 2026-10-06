import { LedgerType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type WalletMutation = {
  userId: string;
  amountMinor: bigint;
  reference: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

export async function creditWallet(input: WalletMutation) {
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
          type: LedgerType.CREDIT,
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

export async function debitWallet(input: WalletMutation) {
  if (input.amountMinor <= 0n) throw new Error("Debit amount must be positive");

  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new Error("Wallet not found");
    if (wallet.balanceMinor < input.amountMinor) throw new Error("Insufficient wallet balance");

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: { decrement: input.amountMinor } },
    });

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

    return { wallet: updated, ledger };
  });
}

export async function refundWallet(input: WalletMutation) {
  return creditWallet({
    ...input,
    description: input.description || "Order refund",
  });
}
