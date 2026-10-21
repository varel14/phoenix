import { prisma } from "../config/prisma.js";
import { AppError } from "../lib/errors.js";
import { PAYMENT_REFERENCE_PREFIX, generateReference } from "../lib/refs.js";
import { paymentRepository, type PaymentServiceWithFields, type PaymentTransactionWithRelations } from "../repositories/payment.repository.js";
import { orderService } from "./order.service.js";
import { paymentProviderService } from "./payment-provider.service.js";
import type { InitiatePaymentBody, ListPaymentsQuery, PaymentWebhookBody } from "../validators/payment.schema.js";
import type { PaymentCategory, PaymentService } from "../generated/prisma/client.js";

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELLED", "REFUNDED"]);

type ServiceFieldValues = Record<string, string>;

function validateServiceFields(service: PaymentServiceWithFields, values: ServiceFieldValues): ServiceFieldValues {
  const validated: ServiceFieldValues = {};
  for (const field of service.fields) {
    const value = values[field.key]?.trim();
    if (field.required && !value) {
      throw AppError.badRequest(`The field "${field.label}" is required`);
    }
    if (!value) continue;
    switch (field.type) {
      case "NUMBER":
        if (!/^\d+([.,]\d{1,2})?$/.test(value)) {
          throw AppError.badRequest(`The field "${field.label}" must be a number`);
        }
        break;
      case "PHONE":
        if (!/^[+\d][\d\s.-]{7,19}$/.test(value)) {
          throw AppError.badRequest(`The field "${field.label}" must be a valid phone number`);
        }
        break;
      case "EMAIL":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw AppError.badRequest(`The field "${field.label}" must be a valid email address`);
        }
        break;
      case "SELECT": {
        const options = Array.isArray(field.options) ? (field.options as string[]) : [];
        if (options.length > 0 && !options.includes(value)) {
          throw AppError.badRequest(`The field "${field.label}" has an invalid value`);
        }
        break;
      }
      default:
        break;
    }
    validated[field.key] = value;
  }
  return validated;
}

function resolveAmount(service: PaymentServiceWithFields, providedAmount: number | undefined): number {
  if (service.pricingMode === "FIXED") {
    if (service.fixedPrice == null) {
      throw AppError.unprocessable("This service is not configured with a price yet");
    }
    if (providedAmount != null && providedAmount !== service.fixedPrice) {
      throw AppError.badRequest("The provided amount does not match the service price");
    }
    return service.fixedPrice;
  }
  if (providedAmount == null) {
    throw AppError.badRequest("An amount is required for this service");
  }
  const minPrice = service.minPrice ?? 100;
  if (providedAmount < minPrice) {
    throw AppError.badRequest(`The minimum amount for this service is ${minPrice} ${service.currency}`);
  }
  return providedAmount;
}

export const paymentService = {
  // ------------------------------------------------------------- catalog
  listCategories(): Promise<PaymentCategory[]> {
    return paymentRepository.findCategories();
  },

  async listServices(options: { categoryId?: string | undefined }): Promise<PaymentService[]> {
    return paymentRepository.findServices(options);
  },

  async getService(id: string): Promise<PaymentServiceWithFields> {
    const service = await paymentRepository.findServiceById(id);
    if (!service) throw AppError.notFound("Payment service");
    return service;
  },

  // ---------------------------------------------------------- initiation
  async initiate(
    userId: string,
    body: InitiatePaymentBody,
    customerEmail?: string,
  ): Promise<{ transaction: PaymentTransactionWithRelations; paymentUrl: string | null; instructions: string | null }> {
    const service = await paymentRepository.findServiceById(body.serviceId);
    if (!service) throw AppError.notFound("Payment service");

    const fields = validateServiceFields(service, body.fields);
    const amount = resolveAmount(service, body.amount);

    const metadata = (service.metadata ?? null) as { provider?: string } | null;
    const provider = paymentProviderService.get(metadata?.provider);
    const reference = generateReference(PAYMENT_REFERENCE_PREFIX);

    const initiation = await provider.initiate({
      reference,
      amount,
      currency: service.currency,
      description: service.name,
      customerEmail,
    });

    const transaction = await prisma.paymentTransaction.create({
      data: {
        userId,
        serviceId: service.id,
        reference,
        provider: provider.name,
        amount,
        currency: service.currency,
        status: "PENDING",
        metadata: {
          fields,
          instructions: initiation.instructions ?? null,
        },
      },
      include: {
        service: { include: { category: true } },
        receipt: true,
        order: { include: { items: true } },
      },
    });

    return { transaction, paymentUrl: initiation.paymentUrl ?? null, instructions: initiation.instructions ?? null };
  },

  /**
   * Creates the pending transaction that pays a marketplace order. The order
   * only becomes PAID through confirmFromWebhook — never client-side.
   */
  async initiateForOrder(
    userId: string,
    order: { id: string; reference: string; total: number; currency: string },
    customerEmail?: string,
  ): Promise<{ transaction: PaymentTransactionWithRelations; paymentUrl: string | null; instructions: string | null }> {
    const provider = paymentProviderService.get(undefined);
    const reference = generateReference(PAYMENT_REFERENCE_PREFIX);
    const initiation = await provider.initiate({
      reference,
      amount: order.total,
      currency: order.currency,
      description: `Commande ${order.reference}`,
      customerEmail,
    });
    const transaction = await prisma.paymentTransaction.create({
      data: {
        userId,
        orderId: order.id,
        reference,
        provider: provider.name,
        amount: order.total,
        currency: order.currency,
        status: "PENDING",
        metadata: { instructions: initiation.instructions ?? null },
      },
      include: {
        service: { include: { category: true } },
        receipt: true,
        order: { include: { items: true } },
      },
    });
    return { transaction, paymentUrl: initiation.paymentUrl ?? null, instructions: initiation.instructions ?? null };
  },

  // ---------------------------------------------------------- confirmation
  /**
   * Webhook-driven confirmation. Idempotent: replayed webhooks for an already
   * terminal transaction return the current state without side effects.
   */
  async confirmFromWebhook(
    providerName: string,
    body: PaymentWebhookBody,
  ): Promise<{ transaction: PaymentTransactionWithRelations; duplicate: boolean }> {
    const transaction = await paymentRepository.findTransactionByReference(body.reference);
    if (!transaction) throw AppError.notFound("Payment transaction");
    if (transaction.provider !== providerName) {
      throw AppError.badRequest("This transaction was not initiated with this provider");
    }
    if (TERMINAL_STATUSES.has(transaction.status)) {
      return { transaction, duplicate: true };
    }

    if (body.status === "SUCCESS") {
      const updated = await this.markSuccess(transaction, body.providerReference, body.method);
      return { transaction: updated, duplicate: false };
    }
    const failed = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: "FAILED", providerReference: body.providerReference ?? null },
      include: {
        service: { include: { category: true } },
        receipt: true,
        order: { include: { items: true } },
      },
    });
    return { transaction: failed, duplicate: false };
  },

  async markSuccess(
    transaction: PaymentTransactionWithRelations,
    providerReference?: string | undefined,
    method?: string | undefined,
  ): Promise<PaymentTransactionWithRelations> {
    const now = new Date();
    const [updated] = await Promise.all([
      prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "SUCCESS", paidAt: now, providerReference: providerReference ?? transaction.providerReference },
        include: {
          service: { include: { category: true } },
          receipt: true,
          order: { include: { items: true } },
        },
      }),
      // Receipt is generated server-side, exactly once per transaction.
      prisma.paymentReceipt.upsert({
        where: { transactionId: transaction.id },
        create: {
          transactionId: transaction.id,
          reference: transaction.reference,
          externalReference: providerReference ?? null,
          amount: transaction.amount,
          currency: transaction.currency,
          method: method ?? transaction.provider,
        },
        update: {},
      }),
    ]);

    // Marketplace order fulfillment when the payment was tied to an order.
    if (transaction.orderId) {
      await orderService.markPaid(transaction.orderId);
    }
    return updated;
  },

  // -------------------------------------------------------------- history
  async listTransactions(
    userId: string,
    query: ListPaymentsQuery,
  ): Promise<{ transactions: PaymentTransactionWithRelations[]; total: number }> {
    const [transactions, total] = await Promise.all([
      paymentRepository.findTransactionsByUser(userId, query),
      paymentRepository.countTransactionsByUser(userId, query.status),
    ]);
    return { transactions, total };
  },

  async getTransactionForUser(userId: string, id: string): Promise<PaymentTransactionWithRelations> {
    const transaction = await paymentRepository.findTransactionById(id);
    if (!transaction || transaction.userId !== userId) throw AppError.notFound("Payment transaction");
    return transaction;
  },

  /** Same ownership rule as getTransactionForUser, keyed by the public reference. */
  async getTransactionByReferenceForUser(userId: string, reference: string): Promise<PaymentTransactionWithRelations> {
    const transaction = await paymentRepository.findTransactionByReference(reference);
    if (!transaction || transaction.userId !== userId) throw AppError.notFound("Payment transaction");
    return transaction;
  },
};
