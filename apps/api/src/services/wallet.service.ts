import { prisma } from "../config/prisma.js";
import { AppError } from "../lib/errors.js";
import { WALLET_REFERENCE_PREFIX, generateReference } from "../lib/refs.js";
import {
  userFollowRepository,
  type UserFollowRef,
} from "../repositories/follow.repository.js";
import {
  walletRepository,
  type WalletTransactionWithCounterparty,
} from "../repositories/wallet.repository.js";
import { getFollowState, type UserFollowState } from "./user.service.js";
import type {
  InitiateTopupBody,
  ListWalletTransactionsQuery,
  TransferBody,
} from "../validators/wallet.schema.js";
import type { Prisma, Wallet } from "../generated/prisma/client.js";

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED"]);

/** Recipient with follow context — mutual follows are the payment inner circle. */
export type WalletRecipientWithFollow = UserFollowRef & {
  isFollowing: boolean;
  isMutual: boolean;
};

export type WalletLedgerResult = {
  transaction: WalletTransactionWithCounterparty;
  wallet: Wallet;
  duplicate: boolean;
};

/** Error code surfaced when a wallet cannot cover a charge (mobile shows a top-up prompt). */
export const INSUFFICIENT_BALANCE_CODE = "INSUFFICIENT_BALANCE";

export const walletService = {
  // --------------------------------------------------------------- wallet
  /** Wallets are created lazily on first touch — no migration backfill needed. */
  async ensureWallet(userId: string): Promise<Wallet> {
    const existing = await walletRepository.findByUserId(userId);
    if (existing) return existing;
    try {
      return await walletRepository.createForUser(userId);
    } catch {
      // Unique violation → another request created it concurrently.
      const wallet = await walletRepository.findByUserId(userId);
      if (!wallet) throw AppError.internal("Wallet could not be created");
      return wallet;
    }
  },

  async getWalletSummary(userId: string): Promise<Wallet> {
    return this.ensureWallet(userId);
  },

  // ---------------------------------------------------------------- topups
  /** Creates a PENDING top-up. The balance is only credited on confirmation. */
  async initiateTopup(
    userId: string,
    body: InitiateTopupBody,
  ): Promise<WalletTransactionWithCounterparty> {
    const wallet = await this.ensureWallet(userId);
    return prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "TOPUP",
        status: "PENDING",
        amount: body.amount,
        currency: wallet.currency,
        reference: generateReference(WALLET_REFERENCE_PREFIX),
        note: body.note ?? null,
      },
      include: {
        counterparty: { select: { id: true, name: true, image: true } },
      },
    });
  },

  /**
   * Confirms a pending top-up and credits the balance in one transaction —
   * the exact entry point a provider webhook would call in production.
   * Idempotent: already-confirmed top-ups return the current state.
   */
  async confirmTopup(reference: string): Promise<WalletLedgerResult> {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.walletTransaction.findUnique({
        where: { reference },
        include: {
          counterparty: { select: { id: true, name: true, image: true } },
        },
      });
      if (!entry) throw AppError.notFound("Wallet transaction");
      if (TERMINAL_STATUSES.has(entry.status)) {
        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { id: entry.walletId },
        });
        return { transaction: entry, wallet, duplicate: true };
      }

      const wallet = await tx.wallet.update({
        where: { id: entry.walletId },
        data: { balance: { increment: entry.amount } },
      });
      const transaction = await tx.walletTransaction.update({
        where: { id: entry.id },
        data: { status: "SUCCESS", balanceAfter: wallet.balance },
        include: {
          counterparty: { select: { id: true, name: true, image: true } },
        },
      });
      return { transaction, wallet, duplicate: false };
    });
  },

  /** Dev-only shortcut: pushes a SUCCESS confirmation through confirmTopup. */
  async devConfirmTopup(
    userId: string,
    reference: string,
  ): Promise<WalletLedgerResult> {
    const entry = await walletRepository.findTransactionByReference(reference);
    if (!entry || entry.wallet.userId !== userId)
      throw AppError.notFound("Wallet transaction");
    if (entry.type !== "TOPUP")
      throw AppError.badRequest("Only top-ups can be confirmed this way");
    return this.confirmTopup(reference);
  },

  // ------------------------------------------------------------- transfers
  /**
   * Peer-to-peer transfer: debits the sender and credits the recipient in one
   * atomic transaction. Wallet rows are always touched in id order so two
   * simultaneous opposite transfers cannot deadlock.
   */
  async transfer(
    userId: string,
    body: TransferBody,
  ): Promise<WalletLedgerResult> {
    if (body.recipientId === userId) {
      throw AppError.badRequest("You cannot send money to yourself");
    }
    const recipient = await prisma.user.findUnique({
      where: { id: body.recipientId },
      select: { id: true },
    });
    if (!recipient) throw AppError.notFound("Recipient");

    const senderWallet = await this.ensureWallet(userId);
    const recipientWallet = await this.ensureWallet(body.recipientId);

    const transferRef = generateReference(WALLET_REFERENCE_PREFIX);
    const ordered = [senderWallet, recipientWallet].sort((a, b) =>
      a.id.localeCompare(b.id),
    );

    return prisma.$transaction(async (tx) => {
      let senderBalance: number | undefined;
      let recipientBalance: number | undefined;

      for (const wallet of ordered) {
        if (wallet.id === senderWallet.id) {
          // Conditional decrement: fails when the balance is insufficient.
          const debited = await tx.wallet.updateMany({
            where: { id: wallet.id, balance: { gte: body.amount } },
            data: { balance: { decrement: body.amount } },
          });
          if (debited.count === 0) {
            throw AppError.unprocessable("Insufficient wallet balance");
          }
          senderBalance = (
            await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } })
          ).balance;
        } else {
          const credited = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: body.amount } },
          });
          recipientBalance = credited.balance;
        }
      }

      await tx.walletTransaction.createMany({
        data: [
          {
            walletId: senderWallet.id,
            type: "TRANSFER_OUT",
            status: "SUCCESS",
            amount: body.amount,
            balanceAfter: senderBalance ?? null,
            currency: senderWallet.currency,
            reference: generateReference(WALLET_REFERENCE_PREFIX),
            transferRef,
            note: body.note ?? null,
            counterpartyId: body.recipientId,
          },
          {
            walletId: recipientWallet.id,
            type: "TRANSFER_IN",
            status: "SUCCESS",
            amount: body.amount,
            balanceAfter: recipientBalance ?? null,
            currency: recipientWallet.currency,
            reference: generateReference(WALLET_REFERENCE_PREFIX),
            transferRef,
            note: body.note ?? null,
            counterpartyId: userId,
          },
        ],
      });

      const transaction = await tx.walletTransaction.findFirstOrThrow({
        where: { transferRef, walletId: senderWallet.id },
        include: {
          counterparty: { select: { id: true, name: true, image: true } },
        },
      });
      const updatedSenderWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: senderWallet.id },
      });
      return { transaction, wallet: updatedSenderWallet, duplicate: false };
    });
  },

  // ------------------------------------------------------- download charges
  /**
   * Settles a paid download inside the caller's transaction: debits the fan,
   * credits the artist, and records the paired ledger entries with
   * `kind: "song-download"` metadata so artist revenue is traceable. Wallet
   * rows are locked in id order (same pattern as transfers). Throws
   * INSUFFICIENT_BALANCE when the fan's wallet cannot cover the amount —
   * aborting the surrounding transaction (no download row is kept unpaid).
   */
  async settleDownloadCharge(
    tx: Prisma.TransactionClient,
    input: {
      buyerId: string;
      artistUserId: string;
      amount: number;
      songId: string;
      downloadId: string;
      songTitle: string;
      currency: string;
    },
  ): Promise<{ buyerBalance: number }> {
    if (input.buyerId === input.artistUserId) {
      // Artists downloading their own songs: nothing moves, the row is free.
      return {
        buyerBalance: (await this.ensureWalletInTx(tx, input.buyerId)).balance,
      };
    }

    const buyerWallet = await this.ensureWalletInTx(tx, input.buyerId);
    const artistWallet = await this.ensureWalletInTx(tx, input.artistUserId);
    const transferRef = generateReference(WALLET_REFERENCE_PREFIX);
    const metadata = {
      kind: "song-download",
      songId: input.songId,
      downloadId: input.downloadId,
    };
    const note = `Téléchargement — ${input.songTitle}`;
    const ordered = [buyerWallet, artistWallet].sort((a, b) =>
      a.id.localeCompare(b.id),
    );

    let buyerBalance: number | undefined;
    let artistBalance: number | undefined;
    for (const wallet of ordered) {
      if (wallet.id === buyerWallet.id) {
        const debited = await tx.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: input.amount } },
          data: { balance: { decrement: input.amount } },
        });
        if (debited.count === 0) {
          throw new AppError(
            422,
            INSUFFICIENT_BALANCE_CODE,
            "Solde insuffisant — rechargez votre portefeuille pour télécharger",
          );
        }
        buyerBalance = (
          await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } })
        ).balance;
      } else {
        artistBalance = (
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: input.amount } },
          })
        ).balance;
      }
    }

    await tx.walletTransaction.createMany({
      data: [
        {
          walletId: buyerWallet.id,
          type: "TRANSFER_OUT",
          status: "SUCCESS",
          amount: input.amount,
          balanceAfter: buyerBalance ?? null,
          currency: input.currency,
          reference: generateReference(WALLET_REFERENCE_PREFIX),
          transferRef,
          note,
          counterpartyId: input.artistUserId,
          metadata,
        },
        {
          walletId: artistWallet.id,
          type: "TRANSFER_IN",
          status: "SUCCESS",
          amount: input.amount,
          balanceAfter: artistBalance ?? null,
          currency: input.currency,
          reference: generateReference(WALLET_REFERENCE_PREFIX),
          transferRef,
          note,
          counterpartyId: input.buyerId,
          metadata,
        },
      ],
    });
    return { buyerBalance: buyerBalance! };
  },

  /** ensureWallet variant bound to an open transaction. */
  async ensureWalletInTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<Wallet> {
    const existing = await tx.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    return tx.wallet.create({ data: { userId, balance: 0 } });
  },

  // ---------------------------------------------------------------- ledger
  async listTransactions(
    userId: string,
    query: ListWalletTransactionsQuery,
  ): Promise<{
    transactions: WalletTransactionWithCounterparty[];
    total: number;
  }> {
    const wallet = await this.ensureWallet(userId);
    const [transactions, total] = await Promise.all([
      walletRepository.listTransactions(wallet.id, query),
      walletRepository.countTransactions(wallet.id, query.type),
    ]);
    return { transactions, total };
  },

  async getTransactionForUser(
    userId: string,
    id: string,
  ): Promise<
    WalletTransactionWithCounterparty & {
      counterparty: (UserFollowRef & UserFollowState) | null;
    }
  > {
    const wallet = await this.ensureWallet(userId);
    const transaction = await prisma.walletTransaction.findFirst({
      where: { id, walletId: wallet.id },
      include: {
        counterparty: { select: { id: true, name: true, image: true } },
      },
    });
    if (!transaction) throw AppError.notFound("Wallet transaction");
    if (!transaction.counterparty) {
      return { ...transaction, counterparty: null };
    }
    const followState = await getFollowState(
      userId,
      transaction.counterparty.id,
    );
    return {
      ...transaction,
      counterparty: { ...transaction.counterparty, ...followState },
    };
  },

  // ------------------------------------------------------------ recipients
  /**
   * Transfer recipients: with a search term, similarity matches win outright
   * (follow flags still attached). Without one, mutual follows first (the
   * payment inner circle), then the rest of the follow graph, then chat
   * contacts and recent counterparties.
   */
  async listRecipients(userId: string, search?: string | undefined) {
    if (search) {
      const matches = await walletRepository.searchUsers(userId, search);
      const ids = matches.map((match) => match.id);
      const [following, followers] = await Promise.all([
        userFollowRepository.findAnyFollowingIds(userId, ids),
        userFollowRepository.findFollowerIds(userId, ids),
      ]);
      return matches.map<WalletRecipientWithFollow>((match) => ({
        ...match,
        // Any edge (pending request or accepted) marks a pursued contact.
        isFollowing: following.has(match.id),
        isMutual: following.has(match.id) && followers.has(match.id),
      }));
    }

    const [mutualFollows, followedUsers, pendingOutgoing, contactIds] =
      await Promise.all([
        userFollowRepository.findMutualFollowing(userId, 20),
        userFollowRepository.listFollowing(userId, 20),
        userFollowRepository.listOutgoingAny(userId, 20),
        walletRepository.findContactIds(userId),
      ]);
    const contacts =
      contactIds.length > 0
        ? await walletRepository.findUsersByIds(contactIds)
        : [];

    const merged = new Map<
      string,
      { id: string; name: string; image: string | null }
    >();
    for (const mutual of mutualFollows) merged.set(mutual.id, mutual);
    for (const followed of followedUsers) {
      if (!merged.has(followed.id)) merged.set(followed.id, followed);
    }
    for (const pending of pendingOutgoing) {
      if (!merged.has(pending.id)) merged.set(pending.id, pending);
    }
    for (const contact of contacts) {
      if (!merged.has(contact.id)) merged.set(contact.id, contact);
    }

    const entries = [...merged.values()].slice(0, 20);
    const [following, followers] = await Promise.all([
      userFollowRepository.findAnyFollowingIds(
        userId,
        entries.map((entry) => entry.id),
      ),
      userFollowRepository.findFollowerIds(
        userId,
        entries.map((entry) => entry.id),
      ),
    ]);
    return entries.map<WalletRecipientWithFollow>((entry) => ({
      ...entry,
      isFollowing: following.has(entry.id),
      isMutual: following.has(entry.id) && followers.has(entry.id),
    }));
  },
};
