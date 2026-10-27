import { prisma } from "../config/prisma.js";
import { AppError } from "../lib/errors.js";
import { WALLET_REFERENCE_PREFIX, generateReference } from "../lib/refs.js";
import {
  walletRepository,
  type WalletTransactionWithCounterparty,
} from "../repositories/wallet.repository.js";
import type {
  CreatePaymentMethodBody,
  InitiateTopupBody,
  ListWalletTransactionsQuery,
  MobileMoneyProvider,
  PhoneTransferBody,
  TransferBody,
} from "../validators/wallet.schema.js";
import type {
  PaymentMethod,
  Prisma,
  Wallet,
} from "../generated/prisma/client.js";

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED"]);

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

  // -------------------------------------------------- phone (mobile money)
  /** Strips separators; keeps a leading + for international numbers. */
  normalizePhoneNumber(raw: string): string {
    return raw.replace(/[\s.-]/g, "");
  },

  /**
   * Wires money to a real-world Orange Money / MTN number. When the number
   * belongs to a registered platform user (their wallet address), the money
   * lands in their wallet instantly as a paired internal transfer. Otherwise
   * a PENDING external wire is created for the provider to settle.
   */
  async initiatePhoneTransfer(
    userId: string,
    body: PhoneTransferBody,
  ): Promise<WalletTransactionWithCounterparty> {
    const phoneNumber = this.normalizePhoneNumber(body.phoneNumber);

    // Registered number → instant internal transfer to that wallet address.
    const owner = await walletRepository.findPaymentMethodOwner(phoneNumber);
    if (owner && owner.userId !== userId) {
      const result = await this.transfer(userId, {
        recipientId: owner.userId,
        amount: body.amount,
        ...(body.note ? { note: body.note } : {}),
        via: { provider: body.provider, phoneNumber },
      });
      return result.transaction;
    }

    const wallet = await this.ensureWallet(userId);
    if (wallet.balance < body.amount) {
      throw AppError.unprocessable("Insufficient wallet balance");
    }
    return prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "PHONE_TRANSFER",
        status: "PENDING",
        amount: body.amount,
        currency: wallet.currency,
        reference: generateReference(WALLET_REFERENCE_PREFIX),
        note: body.note ?? null,
        phoneNumber,
        provider: body.provider,
      },
      include: {
        counterparty: { select: { id: true, name: true, image: true } },
      },
    });
  },

  // ------------------------------------------------------ payment methods
  /** The user's registered mobile money numbers — their wallet addresses. */
  async listPaymentMethods(userId: string) {
    return walletRepository.listPaymentMethods(userId);
  },

  async createPaymentMethod(
    userId: string,
    body: CreatePaymentMethodBody,
  ): Promise<PaymentMethod> {
    const phoneNumber = this.normalizePhoneNumber(body.phoneNumber);
    // A number is a wallet address: it belongs to exactly one account.
    const taken = await walletRepository.findPaymentMethodOwner(phoneNumber);
    if (taken) {
      throw AppError.conflict(
        "Ce numéro est déjà associé à un compte Chuyassi Pay",
      );
    }
    const duplicate = await prisma.paymentMethod.findFirst({
      where: { userId, provider: body.provider, phoneNumber },
    });
    if (duplicate) {
      throw AppError.conflict("Ce numéro est déjà enregistré");
    }

    const isFirst = (await walletRepository.countPaymentMethods(userId)) === 0;
    const isDefault = body.isDefault ?? isFirst;
    if (isDefault) await walletRepository.clearDefaultPaymentMethods(userId);
    return walletRepository.createPaymentMethod(userId, {
      provider: body.provider,
      phoneNumber,
      isDefault,
    });
  },

  async deletePaymentMethod(userId: string, id: string): Promise<void> {
    const removed = await walletRepository.deletePaymentMethod(userId, id);
    if (removed === 0) throw AppError.notFound("Payment method");
  },

  async setDefaultPaymentMethod(userId: string, id: string): Promise<void> {
    await walletRepository.clearDefaultPaymentMethods(userId);
    const updated = await walletRepository.setDefaultPaymentMethod(userId, id);
    if (updated === 0) throw AppError.notFound("Payment method");
  },

  /**
   * Completes a pending phone transfer: atomically debits the wallet and
   * marks the entry SUCCESS — the entry point a mobile-money webhook would
   * call in production. Idempotent for already-confirmed transfers.
   */
  async confirmPhoneTransfer(reference: string): Promise<WalletLedgerResult> {
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

      // Conditional decrement: fails when the balance moved below the amount.
      const debited = await tx.wallet.updateMany({
        where: { id: entry.walletId, balance: { gte: entry.amount } },
        data: { balance: { decrement: entry.amount } },
      });
      if (debited.count === 0) {
        throw AppError.unprocessable("Insufficient wallet balance");
      }
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { id: entry.walletId },
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

  /** Dev-only shortcut: pushes a SUCCESS confirmation like a provider webhook. */
  async devConfirmPhoneTransfer(
    userId: string,
    reference: string,
  ): Promise<WalletLedgerResult> {
    const entry = await walletRepository.findTransactionByReference(reference);
    if (!entry || entry.wallet.userId !== userId)
      throw AppError.notFound("Wallet transaction");
    if (entry.type !== "PHONE_TRANSFER")
      throw AppError.badRequest(
        "Only phone transfers can be confirmed this way",
      );
    return this.confirmPhoneTransfer(reference);
  },

  // ------------------------------------------------------------- transfers
  /**
   * Peer-to-peer transfer: debits the sender and credits the recipient in one
   * atomic transaction. Wallet rows are always touched in id order so two
   * simultaneous opposite transfers cannot deadlock.
   */
  async transfer(
    userId: string,
    body: TransferBody & {
      /** Stamp the sender leg with the mobile-money route (phone transfers). */
      via?: { provider: MobileMoneyProvider; phoneNumber: string };
    },
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
            provider: body.via?.provider ?? null,
            phoneNumber: body.via?.phoneNumber ?? null,
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
  ): Promise<WalletTransactionWithCounterparty> {
    const wallet = await this.ensureWallet(userId);
    const transaction = await prisma.walletTransaction.findFirst({
      where: { id, walletId: wallet.id },
      include: {
        counterparty: { select: { id: true, name: true, image: true } },
      },
    });
    if (!transaction) throw AppError.notFound("Wallet transaction");
    return { ...transaction };
  },

  // ------------------------------------------------------------ recipients
  /**
   * Transfer recipients: WhatsApp-style — chat contacts first (people you
   * have a conversation with), then recent counterparties. With a search
   * term, similarity matches win outright.
   */
  async listRecipients(userId: string, search?: string | undefined) {
    if (search) {
      return walletRepository.searchUsers(userId, search);
    }

    const [contactIds, counterparties] = await Promise.all([
      walletRepository.findContactIds(userId),
      walletRepository.recentCounterparties(userId, 20),
    ]);
    const contacts =
      contactIds.length > 0
        ? await walletRepository.findUsersByIds(contactIds)
        : [];

    const merged = new Map<
      string,
      { id: string; name: string; image: string | null }
    >();
    for (const contact of contacts) merged.set(contact.id, contact);
    for (const counterparty of counterparties) {
      if (!merged.has(counterparty.id))
        merged.set(counterparty.id, counterparty);
    }
    return [...merged.values()].slice(0, 20);
  },
};
