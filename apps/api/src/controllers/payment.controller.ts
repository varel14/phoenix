import type { Request, Response } from "express";
import { z } from "zod";
import { paymentService } from "../services/payment.service.js";
import { paymentProviderService } from "../services/payment-provider.service.js";
import { buildPagination, sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { verifyWebhookSignature } from "../lib/webhook-signature.js";
import { paymentWebhookBodySchema } from "../validators/payment.schema.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type {
  InitiatePaymentBody,
  ListPaymentsQuery,
  ListPaymentServicesQuery,
  PaymentWebhookBody,
} from "../validators/payment.schema.js";
import type { idParamsSchema } from "../validators/common.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

const referenceParamsSchema = z.object({ reference: z.string().min(1).max(100) });

export const paymentController = {
  async listCategories(_req: Request, res: Response) {
    const categories = await paymentService.listCategories();
    sendSuccess(res, categories);
  },

  async listServices(req: Request, res: Response) {
    const query = validatedQuery<ListPaymentServicesQuery>(req);
    const services = await paymentService.listServices({ categoryId: query.categoryId });
    sendSuccess(res, services);
  },

  async getService(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const service = await paymentService.getService(id);
    sendSuccess(res, service);
  },

  async initiate(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<InitiatePaymentBody>(req);
    const { transaction, paymentUrl, instructions } = await paymentService.initiate(user.id, body, user.email);
    sendSuccess(res, { transaction, paymentUrl, instructions }, 201);
  },

  /** Never trust the mobile client: success only ever comes through this webhook. */
  async webhook(req: Request, res: Response) {
    const providerName = req.params["provider"] as string;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) throw AppError.badRequest("Missing request body");
    const signature = req.get("x-phoenix-signature");
    if (!verifyWebhookSignature(rawBody, signature)) {
      throw AppError.unauthorized("Invalid webhook signature");
    }
    const parsed = paymentWebhookBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation("Invalid webhook payload", parsed.error.issues);
    }
    const result = await paymentService.confirmFromWebhook(providerName, parsed.data as PaymentWebhookBody);
    // Always 200 so providers stop retrying; duplicates are reported explicitly.
    sendSuccess(res, { received: true, duplicate: result.duplicate, status: result.transaction.status });
  },

  /**
   * Development shortcut: pushes a SUCCESS payload through the exact same
   * webhook confirmation pipeline, so no client can ever self-confirm.
   * Disabled in production.
   */
  async devConfirm(req: Request, res: Response) {
    if (env.isProduction) throw AppError.notFound();
    const user = requireUser(req);
    const { reference } = validatedParams<z.infer<typeof referenceParamsSchema>>(req);
    await paymentService.getTransactionForUser(user.id, reference);
    const provider = paymentProviderService.get(undefined);
    const result = await paymentService.confirmFromWebhook(provider.name, {
      reference,
      providerReference: `DEV-${Date.now()}`,
      status: "SUCCESS",
      method: provider.name,
    });
    sendSuccess(res, { transaction: result.transaction, duplicate: result.duplicate });
  },

  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<ListPaymentsQuery>(req);
    const { transactions, total } = await paymentService.listTransactions(user.id, query);
    sendPaginated(res, transactions, buildPagination(query.page, query.limit, total));
  },

  async detail(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const transaction = await paymentService.getTransactionForUser(user.id, id);
    sendSuccess(res, transaction);
  },
};
