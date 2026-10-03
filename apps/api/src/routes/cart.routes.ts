import { Router } from "express";
import { cartController } from "../controllers/cart.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { addCartItemBodySchema, updateCartItemBodySchema } from "../validators/cart.schema.js";

export const cartRouter = Router();

cartRouter.use(requireAuth);

cartRouter.get("/", cartController.show);
cartRouter.post("/items", validate({ body: addCartItemBodySchema }), cartController.addItem);
cartRouter.patch("/items/:id", validate({ params: idParamsSchema, body: updateCartItemBodySchema }), cartController.updateItem);
cartRouter.delete("/items/:id", validate({ params: idParamsSchema }), cartController.removeItem);
cartRouter.delete("/", cartController.clear);
