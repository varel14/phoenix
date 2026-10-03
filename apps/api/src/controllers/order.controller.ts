import type { Request, Response } from "express";
import { z } from "zod";
import { orderService } from "../services/order.service.js";
import { paymentService } from "../services/payment.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { CreateOrderBody, ListOrdersQuery, orderDownloadParamsSchema } from "../validators/order.schema.js";
import type { idParamsSchema } from "../validators/common.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const orderController = {
  /** Checkout: order from cart + pending payment transaction, in one call. */
  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<CreateOrderBody>(req);
    const order = await orderService.createFromCart(user.id, body);
    const { transaction, paymentUrl, instructions } = await paymentService.initiateForOrder(
      user.id,
      order,
      user.email,
    );
    sendSuccess(res, { order, transaction, paymentUrl, instructions }, 201);
  },

  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<ListOrdersQuery>(req);
    const { orders, pagination } = await orderService.list(user.id, query);
    sendPaginated(res, orders, pagination);
  },

  async detail(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const order = await orderService.getForUser(user.id, id);
    sendSuccess(res, order);
  },

  /** Protected digital download — never a long-lived public URL. */
  async download(req: Request, res: Response) {
    const user = requireUser(req);
    const { orderId, itemId } = validatedParams<z.infer<typeof orderDownloadParamsSchema>>(req);
    const download = await orderService.authorizeDigitalDownload(user.id, orderId, itemId);
    if (download.mode === "url") {
      // R2 mode: hand back a short-lived presigned URL for the client to fetch.
      sendSuccess(res, { downloadUrl: download.downloadUrl, fileName: download.fileName });
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(download.fileSizeBytes));
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(download.fileName)}"`);
    download.stream.pipe(res);
  },
};
