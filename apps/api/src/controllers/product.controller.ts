import type { Request, Response } from "express";
import { productService, productCategoryService } from "../services/product.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { CreateProductBody, ListProductsQuery, UpdateProductBody } from "../validators/product.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const productController = {
  async list(req: Request, res: Response) {
    const query = validatedQuery<ListProductsQuery>(req);
    const { products, pagination } = await productService.list(query);
    sendPaginated(res, products, pagination);
  },

  async detail(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const product = await productService.getDetail(id);
    sendSuccess(res, product);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<CreateProductBody>(req);
    const product = await productService.createForArtist(user.id, body);
    sendSuccess(res, product, 201);
  },

  async update(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<UpdateProductBody>(req);
    const product = await productService.updateForArtist(user.id, id, body);
    sendSuccess(res, product);
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await productService.removeForArtist(user.id, id);
    sendSuccess(res, { removed: true });
  },
};

export const productCategoryController = {
  async list(_req: Request, res: Response) {
    const categories = await productCategoryService.list();
    sendSuccess(res, categories);
  },
};
