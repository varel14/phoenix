import { Router } from "express";
import { paymentController } from "../controllers/payment.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import {
  initiatePaymentBodySchema,
  listPaymentServicesQuerySchema,
  listPaymentsQuerySchema,
} from "../validators/payment.schema.js";

/**
 * Mounted at the API root: exposes /payment-categories, /payment-services
 * and /payments endpoints in one domain router.
 */
export const paymentRouter = Router();

// Catalog is public read-only.
paymentRouter.get("/payment-categories", paymentController.listCategories);
paymentRouter.get("/payment-services", validate({ query: listPaymentServicesQuerySchema }), paymentController.listServices);
paymentRouter.get("/payment-services/:id", validate({ params: idParamsSchema }), paymentController.getService);

// Provider webhooks — the raw body was captured by the JSON parser (see app.ts)
// and is used for HMAC signature verification.
paymentRouter.post("/payments/webhook/:provider", paymentController.webhook);

paymentRouter.use("/payments", requireAuth);

paymentRouter.post("/payments", validate({ body: initiatePaymentBodySchema }), paymentController.initiate);
paymentRouter.get("/payments", validate({ query: listPaymentsQuerySchema }), paymentController.list);
paymentRouter.get("/payments/:id", validate({ params: idParamsSchema }), paymentController.detail);
paymentRouter.post("/payments/:reference/dev-confirm", paymentController.devConfirm);
