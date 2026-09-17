import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { z } from "zod";
import { AppError } from "../lib/errors.js";

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Parses and validates request data with zod, storing results on
 * req.validated (Express 5 makes req.query a read-only getter, so parsed
 * query data is exposed through req.validated.query instead).
 *
 * Controllers read the validated data back with the typed helpers below.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const validated: Record<string, unknown> = {};
      if (schemas.body) validated["body"] = schemas.body.parse(req.body);
      if (schemas.query) validated["query"] = schemas.query.parse(req.query);
      if (schemas.params) validated["params"] = schemas.params.parse(req.params);
      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          AppError.validation(
            "Validation failed",
            error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          ),
        );
        return;
      }
      next(error);
    }
  };
}

export function validatedBody<T>(req: Request): T {
  return req.validated?.["body"] as T;
}

export function validatedQuery<T>(req: Request): T {
  return req.validated?.["query"] as T;
}

export function validatedParams<T>(req: Request): T {
  return req.validated?.["params"] as T;
}
