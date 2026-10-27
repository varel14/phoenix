import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

export const walletTransactionInclude = {
  counterparty: { select: { id: true, name: true, image: true } },
} as const;

export type WalletWithTransactions = Prisma.WalletGetPayload<{
  include: { transactions: true };
}>;
export type WalletTransactionWithCounterparty =
  Prisma.WalletTransactionGetPayload<{
    include: typeof walletTransactionInclude;
  }>;

/** Ledger rows joined with their wallet owner id, for ownership checks. */
export type LedgerEntryForUser = Prisma.WalletTransactionGetPayload<{
  include: typeof walletTransactionInclude & {
    wallet: { select: { userId: true } };
  };
}>;

export const walletRepository = {
  // --------------------------------------------------------------- wallet
  async findByUserId(userId: string) {
    return prisma.wallet.findUnique({ where: { userId } });
  },

  async createForUser(userId: string) {
    return prisma.wallet.create({ data: { userId } });
  },

  // ----------------------------------------------------------- ledger rows
  async findTransactionByReference(
    reference: string,
  ): Promise<LedgerEntryForUser | null> {
    return prisma.walletTransaction.findUnique({
      where: { reference },
      include: {
        ...walletTransactionInclude,
        wallet: { select: { userId: true } },
      },
    });
  },

  async listTransactions(
    walletId: string,
    options: { page: number; limit: number; type?: string | undefined },
  ): Promise<WalletTransactionWithCounterparty[]> {
    return prisma.walletTransaction.findMany({
      where: {
        walletId,
        ...(options.type ? { type: options.type as never } : {}),
      },
      include: walletTransactionInclude,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async countTransactions(
    walletId: string,
    type?: string | undefined,
  ): Promise<number> {
    return prisma.walletTransaction.count({
      where: { walletId, ...(type ? { type: type as never } : {}) },
    });
  },

  /**
   * People worth suggesting as transfer recipients: chat contacts (direct
   * conversation partners) merged with recent transfer counterparties.
   */
  /** Distinct recent transfer counterparties as wallet recipients. */
  async recentCounterparties(
    userId: string,
    take = 20,
  ): Promise<Array<{ id: string; name: string; image: string | null }>> {
    const rows = await prisma.walletTransaction.findMany({
      where: {
        wallet: { userId },
        type: "TRANSFER_OUT",
        counterpartyId: { not: null },
      },
      select: { counterpartyId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const ids: string[] = [];
    for (const row of rows) {
      const id = row.counterpartyId!;
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= take) break;
    }
    if (ids.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, image: true },
    });
    return ids
      .map((id) => users.find((user) => user.id === id))
      .filter(
        (user): user is { id: string; name: string; image: string | null } =>
          Boolean(user),
      );
  },

  async findContactIds(userId: string): Promise<string[]> {
    const memberships = await prisma.conversationParticipant.findMany({
      where: {
        conversation: { participants: { some: { userId } } },
        userId: { not: userId },
      },
      select: { userId: true },
    });
    const outgoing = await prisma.walletTransaction.findMany({
      where: {
        wallet: { userId },
        type: "TRANSFER_OUT",
        counterpartyId: { not: null },
      },
      select: { counterpartyId: true },
      orderBy: { createdAt: "desc" },
      distinct: ["counterpartyId"],
      take: 10,
    });
    return [
      ...new Set([
        ...memberships.map((m) => m.userId),
        ...outgoing.map((t) => t.counterpartyId as string),
      ]),
    ];
  },

  async findUsersByIds(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, image: true },
    });
  },

  /**
   * Typo-tolerant contact search: PostgreSQL trigram similarity (pg_trgm)
   * ranked by closeness, with an ILIKE fallback so short prefixes still hit.
   */
  async searchUsers(userId: string, search: string) {
    return prisma.$queryRaw<
      { id: string; name: string; image: string | null }[]
    >`
      SELECT "id", "name", "image"
      FROM "users"
      WHERE "id" <> ${userId}
        AND (SIMILARITY("name", ${search}) > 0.1 OR "name" ILIKE ${`%${search}%`})
      ORDER BY SIMILARITY("name", ${search}) DESC, "name" ASC
      LIMIT 20`;
  },

  // ------------------------------------------------------- payment methods
  async listPaymentMethods(userId: string) {
    return prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  /**
   * The receive path: a phone number someone wires money to resolves to the
   * platform user who registered it — the number acts as a wallet address.
   */
  async findPaymentMethodOwner(phoneNumber: string) {
    return prisma.paymentMethod.findFirst({
      where: { phoneNumber },
      select: { userId: true },
    });
  },

  async createPaymentMethod(
    userId: string,
    data: {
      provider: "ORANGE_MONEY" | "MTN_MONEY";
      phoneNumber: string;
      isDefault: boolean;
    },
  ) {
    return prisma.paymentMethod.create({ data: { userId, ...data } });
  },

  async countPaymentMethods(userId: string) {
    return prisma.paymentMethod.count({ where: { userId } });
  },

  async clearDefaultPaymentMethods(userId: string) {
    await prisma.paymentMethod.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  },

  async deletePaymentMethod(userId: string, id: string) {
    const result = await prisma.paymentMethod.deleteMany({
      where: { id, userId },
    });
    return result.count;
  },

  async setDefaultPaymentMethod(userId: string, id: string) {
    const updated = await prisma.paymentMethod.updateMany({
      where: { id, userId },
      data: { isDefault: true },
    });
    return updated.count;
  },
};
