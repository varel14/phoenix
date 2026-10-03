import type { Request, Response } from "express";
import { cartService } from "../services/cart.service.js";
import { sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { AddCartItemBody, UpdateCartItemBody } from "../validators/cart.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const cartController = {
  async show(req: Request, res: Response) {
    const user = requireUser(req);
    const cart = await cartService.getCart(user.id);
    sendSuccess(res, cart);
  },

  async addItem(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<AddCartItemBody>(req);
    const cart = await cartService.addItem(user.id, body);
    sendSuccess(res, cart, 201);
  },

  async updateItem(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<UpdateCartItemBody>(req);
    const cart = await cartService.updateItem(user.id, id, body);
    sendSuccess(res, cart);
  },

  async removeItem(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const cart = await cartService.removeItem(user.id, id);
    sendSuccess(res, cart);
  },

  async clear(req: Request, res: Response) {
    const user = requireUser(req);
    const cart = await cartService.clear(user.id);
    sendSuccess(res, cart);
  },
};
