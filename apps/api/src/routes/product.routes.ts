import { Router } from "express";
import { productController, productCategoryController } from "../controllers/product.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import {
  createProductBodySchema,
  listProductsQuerySchema,
  updateProductBodySchema,
} from "../validators/product.schema.js";

export const productRouter = Router();

productRouter.get("/", validate({ query: listProductsQuerySchema }), productController.list);
productRouter.get("/:id", validate({ params: idParamsSchema }), productController.detail);

// Seller management (artist-owned products).
productRouter.post("/", requireAuth, requireRole("ARTIST"), validate({ body: createProductBodySchema }), productController.create);
productRouter.patch(
  "/:id",
  requireAuth,
  requireRole("ARTIST"),
  validate({ params: idParamsSchema, body: updateProductBodySchema }),
  productController.update,
);
productRouter.delete("/:id", requireAuth, requireRole("ARTIST"), validate({ params: idParamsSchema }), productController.remove);

export const productCategoryRouter = Router();

productCategoryRouter.get("/", productCategoryController.list);
