import type { Request, Response } from "express";
import { sendError } from "../lib/responses.js";

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, 404, "NOT_FOUND", `Cannot ${req.method} ${req.path}`);
}
