import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";
import { sendError } from "../lib/responses.js";
import { env } from "../config/env.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, 400, "VALIDATION_ERROR", "Validation failed", {
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      sendError(res, 409, "CONFLICT", "This record already exists");
      return;
    }
    if (err.code === "P2025") {
      sendError(res, 404, "NOT_FOUND", "Resource not found");
      return;
    }
    if (err.code === "P2003") {
      sendError(res, 400, "BAD_REQUEST", "Referenced record does not exist");
      return;
    }
  }

  if (err instanceof SyntaxError && "body" in err) {
    sendError(res, 400, "INVALID_JSON", "Malformed JSON body");
    return;
  }

  console.error("[error] Unhandled error:", err);
  sendError(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    env.isProduction ? "Something went wrong" : String((err as Error)?.message ?? err),
  );
}
