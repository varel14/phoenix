import { Router } from "express";
import { pushController } from "../controllers/push.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { deletePushTokenSchema, registerPushTokenSchema } from "../validators/push.schema.js";

export const pushRouter = Router();

pushRouter.use(requireAuth);

pushRouter.post("/tokens", validate({ body: registerPushTokenSchema }), pushController.register);
pushRouter.delete("/tokens", validate({ body: deletePushTokenSchema }), pushController.remove);
