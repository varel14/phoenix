import { Router } from "express";
import { appLockController } from "../controllers/app-lock.controller.js";
import { validate } from "../middleware/validate.js";
import { verifyUnlockCodeBodySchema } from "../validators/app-lock.schema.js";

/**
 * Mounted under /app-lock: the rotating 3-day app lock. The code endpoint is
 * for the owner's curl workflow (admin key header); verify is what the locked
 * app itself calls and stays public — it gates the sign-in screen too.
 */
export const appLockRouter = Router();

appLockRouter.get("/code", appLockController.getCode);
appLockRouter.post(
  "/verify",
  validate({ body: verifyUnlockCodeBodySchema }),
  appLockController.verify,
);
