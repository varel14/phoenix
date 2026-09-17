import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import type { AuthenticatedUser } from "../types/express.d.js";

/**
 * Requires a valid Better Auth session. Attaches the user to req.user.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      throw AppError.unauthorized();
    }
    req.user = session.user as unknown as AuthenticatedUser;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Requires the authenticated user to have one of the given roles.
 * Must run after requireAuth.
 */
export function requireRole(...roles: Array<"USER" | "ARTIST">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden("This action requires an artist account"));
      return;
    }
    next();
  };
}

/**
 * Attaches the user if a valid session exists, but never rejects.
 * Used for endpoints that behave differently for guests vs users.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session) {
      req.user = session.user as unknown as AuthenticatedUser;
    }
    next();
  } catch {
    next();
  }
}
