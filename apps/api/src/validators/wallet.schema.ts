import { z } from "zod";
import { paginationSchema, userIdSchema } from "./common.js";

export const walletTransactionTypeSchema = z.enum([
  "TOPUP",
  "TRANSFER_IN",
  "TRANSFER_OUT",
]);

/** Minimum top-up mirrors the mobile-money operator floor used across the app. */
export const initiateTopupBodySchema = z.object({
  amount: z.number().int().min(100).max(100_000_000),
  note: z.string().trim().max(200).optional(),
});

export const transferBodySchema = z.object({
  recipientId: userIdSchema,
  amount: z.number().int().min(1).max(100_000_000),
  note: z.string().trim().max(200).optional(),
});

export const listWalletTransactionsQuerySchema = paginationSchema.extend({
  type: walletTransactionTypeSchema.optional(),
});

export const walletRecipientsQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
});

export const referenceParamsSchema = z.object({
  reference: z.string().min(1).max(100),
});

export type InitiateTopupBody = z.infer<typeof initiateTopupBodySchema>;
export type TransferBody = z.infer<typeof transferBodySchema>;
export type ListWalletTransactionsQuery = z.infer<
  typeof listWalletTransactionsQuerySchema
>;
export type WalletRecipientsQuery = z.infer<typeof walletRecipientsQuerySchema>;
export type WalletTransactionType = z.infer<typeof walletTransactionTypeSchema>;
