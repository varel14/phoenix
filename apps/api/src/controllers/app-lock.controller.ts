import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody } from "../middleware/validate.js";
import {
  getCurrentCode,
  sweepThrottle,
  verifyCode,
} from "../services/app-lock.service.js";
import type { VerifyUnlockCodeBody } from "../validators/app-lock.schema.js";

/** Constant-time comparison of the curl endpoint's admin key. */
function adminKeyMatches(presented: string | undefined): boolean {
  if (!presented) return false;
  const expected = Buffer.from(env.APP_LOCK_ADMIN_KEY);
  const given = Buffer.from(presented);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

export const appLockController = {
  /**
   * Current unlock code — for the owner's curl workflow, not the app:
   * `curl -H "x-admin-key: $APP_LOCK_ADMIN_KEY" .../api/v1/app-lock/code`
   */
  async getCode(req: Request, res: Response) {
    if (!adminKeyMatches(req.header("x-admin-key"))) {
      throw AppError.unauthorized("Clé admin requise");
    }
    const { code, window } = getCurrentCode();
    sendSuccess(res, {
      code,
      windowIndex: window.index,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
    });
  },

  /**
   * Entered on the device's lock screen. Public on purpose: the lock also
   * gates the sign-in screen. Returns the window the device is unlocked for.
   */
  async verify(req: Request, res: Response) {
    sweepThrottle();
    const { code } = validatedBody<VerifyUnlockCodeBody>(req);
    const result = verifyCode(code, req.ip ?? "unknown");
    sendSuccess(res, {
      windowIndex: result.windowIndex,
      endsAt: result.endsAt.toISOString(),
    });
  },
};
