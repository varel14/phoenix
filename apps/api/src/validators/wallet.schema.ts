import { z } from "zod";
import { paginationSchema, userIdSchema } from "./common.js";

export const walletTransactionTypeSchema = z.enum([
  "TOPUP",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "PHONE_TRANSFER",
]);

/** Real-world mobile money operators the wallet can wire money to. */
export const mobileMoneyProviderSchema = z.enum(["ORANGE_MONEY", "MTN_MONEY"]);

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

/**
 * Wire money to a real-world Orange Money / MTN Money number — the recipient
 * does not need an account. Local (8-10 digits) or international (+…) formats.
 */
export const phoneTransferBodySchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[+0-9][0-9\s.-]{6,18}$/, "Numéro de téléphone invalide"),
  provider: mobileMoneyProviderSchema,
  amount: z.number().int().min(100).max(100_000_000),
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

/** Register one of the user's mobile money numbers as a payment method. */
export const createPaymentMethodBodySchema = z.object({
  provider: mobileMoneyProviderSchema,
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[+0-9][0-9\s.-]{6,18}$/, "Numéro de téléphone invalide"),
  isDefault: z.boolean().optional(),
});

export type CreatePaymentMethodBody = z.infer<
  typeof createPaymentMethodBodySchema
>;

export type InitiateTopupBody = z.infer<typeof initiateTopupBodySchema>;
export type TransferBody = z.infer<typeof transferBodySchema>;
export type PhoneTransferBody = z.infer<typeof phoneTransferBodySchema>;
export type ListWalletTransactionsQuery = z.infer<
  typeof listWalletTransactionsQuerySchema
>;
export type WalletRecipientsQuery = z.infer<typeof walletRecipientsQuerySchema>;
export type WalletTransactionType = z.infer<typeof walletTransactionTypeSchema>;
export type MobileMoneyProvider = z.infer<typeof mobileMoneyProviderSchema>;
