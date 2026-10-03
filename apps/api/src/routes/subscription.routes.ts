import { Router } from "express";
import { subscriptionController } from "../controllers/subscription.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { subscribeBodySchema, cancelSubscriptionQuerySchema } from "../validators/subscription.schema.js";

export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth);

subscriptionRouter.get("/me", subscriptionController.status);
subscriptionRouter.post("/", validate({ body: subscribeBodySchema }), subscriptionController.subscribe);
subscriptionRouter.delete("/me", validate({ query: cancelSubscriptionQuerySchema }), subscriptionController.cancel);
subscriptionRouter.get("/royalties/mine", subscriptionController.myRoyalties);
subscriptionRouter.get("/royalties/earnings", subscriptionController.artistEarnings);
