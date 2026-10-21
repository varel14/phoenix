import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const paymentTransactionStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);

export const listPaymentServicesQuerySchema = paginationSchema.extend({
  categoryId: uuidSchema.optional(),
});

export const initiatePaymentBodySchema = z.object({
  serviceId: uuidSchema,
  /** Required only for FREE-pricing services; the server decides the amount for FIXED services. */
  amount: z.number().int().positive().max(100_000_000).optional(),
  /** Values for the service's dynamic fields, keyed by field key. */
  fields: z.record(z.string().min(1).max(100), z.coerce.string().trim().max(1000)).default({}),
});

export const listPaymentsQuerySchema = paginationSchema.extend({
  status: paymentTransactionStatusSchema.optional(),
});

/** Transactions are addressed by their public PHX-PAY reference, not their id. */
export const referenceParamsSchema = z.object({
  reference: z.string().min(1).max(100),
});

export const paymentWebhookBodySchema = z.object({
  reference: z.string().min(1).max(100),
  providerReference: z.string().min(1).max(200).optional(),
  status: z.enum(["SUCCESS", "FAILED"]),
  method: z.string().min(1).max(100).optional(),
});

export type PaymentTransactionStatus = z.infer<typeof paymentTransactionStatusSchema>;
export type ListPaymentServicesQuery = z.infer<typeof listPaymentServicesQuerySchema>;
export type InitiatePaymentBody = z.infer<typeof initiatePaymentBodySchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type PaymentWebhookBody = z.infer<typeof paymentWebhookBodySchema>;
