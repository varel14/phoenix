import type { Request, Response } from "express";
import { z } from "zod";
import { walletService } from "../services/wallet.service.js";
import {
  buildPagination,
  sendPaginated,
  sendSuccess,
} from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../middleware/validate.js";
import type {
  CreatePaymentMethodBody,
  InitiateTopupBody,
  ListWalletTransactionsQuery,
  PhoneTransferBody,
  TransferBody,
  WalletRecipientsQuery,
  referenceParamsSchema,
} from "../validators/wallet.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { AuthenticatedUser } from "../types/express.d.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const walletController = {
  async show(req: Request, res: Response) {
    const user = requireUser(req);
    const wallet = await walletService.getWalletSummary(user.id);
    sendSuccess(res, { wallet });
  },

  async transactions(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<ListWalletTransactionsQuery>(req);
    const { transactions, total } = await walletService.listTransactions(
      user.id,
      query,
    );
    sendPaginated(
      res,
      transactions,
      buildPagination(query.page, query.limit, total),
    );
  },

  async initiateTopup(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<InitiateTopupBody>(req);
    const transaction = await walletService.initiateTopup(user.id, body);
    sendSuccess(res, { transaction }, 201);
  },

  /** Wires money to a real-world Orange Money / MTN number (PENDING). */
  async initiatePhoneTransfer(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<PhoneTransferBody>(req);
    const transaction = await walletService.initiatePhoneTransfer(user.id, body);
    sendSuccess(res, { transaction }, 201);
  },

  // ------------------------------------------------------ payment methods
  async listPaymentMethods(req: Request, res: Response) {
    const user = requireUser(req);
    const methods = await walletService.listPaymentMethods(user.id);
    sendSuccess(res, methods);
  },

  async createPaymentMethod(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<CreatePaymentMethodBody>(req);
    const method = await walletService.createPaymentMethod(user.id, body);
    sendSuccess(res, { method }, 201);
  },

  async deletePaymentMethod(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await walletService.deletePaymentMethod(user.id, id);
    res.status(204).end();
  },

  async setDefaultPaymentMethod(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await walletService.setDefaultPaymentMethod(user.id, id);
    const methods = await walletService.listPaymentMethods(user.id);
    sendSuccess(res, methods);
  },

  /**
   * Development shortcut: confirms a pending phone transfer through the same
   * pipeline a mobile-money webhook would drive. Disabled in production.
   */
  async devConfirmPhoneTransfer(req: Request, res: Response) {
    if (env.isProduction) throw AppError.notFound();
    const user = requireUser(req);
    const { reference } =
      validatedParams<z.infer<typeof referenceParamsSchema>>(req);
    const result = await walletService.devConfirmPhoneTransfer(
      user.id,
      reference,
    );
    sendSuccess(res, result);
  },

  /**
   * Development shortcut: confirms a pending top-up through the same pipeline
   * a provider webhook would drive. Disabled in production.
   */
  async devConfirmTopup(req: Request, res: Response) {
    if (env.isProduction) throw AppError.notFound();
    const user = requireUser(req);
    const { reference } =
      validatedParams<z.infer<typeof referenceParamsSchema>>(req);
    const result = await walletService.devConfirmTopup(user.id, reference);
    sendSuccess(res, result);
  },

  async transfer(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<TransferBody>(req);
    const result = await walletService.transfer(user.id, body);
    sendSuccess(res, result, 201);
  },

  async recipients(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<WalletRecipientsQuery>(req);
    const recipients = await walletService.listRecipients(
      user.id,
      query.search,
    );
    sendSuccess(res, recipients);
  },

  async detail(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const transaction = await walletService.getTransactionForUser(user.id, id);
    sendSuccess(res, transaction);
  },
};
