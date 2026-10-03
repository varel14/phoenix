import { Router } from "express";
import { orderController } from "../controllers/order.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { createOrderBodySchema, listOrdersQuerySchema, orderDownloadParamsSchema } from "../validators/order.schema.js";

export const orderRouter = Router();

orderRouter.use(requireAuth);

orderRouter.post("/", validate({ body: createOrderBodySchema }), orderController.create);
orderRouter.get("/", validate({ query: listOrdersQuerySchema }), orderController.list);
orderRouter.get("/:id", validate({ params: idParamsSchema }), orderController.detail);
orderRouter.get(
  "/:orderId/items/:itemId/download",
  validate({ params: orderDownloadParamsSchema }),
  orderController.download,
);
