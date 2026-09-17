import type { Request, Response } from "express";
import { sendSuccess } from "../lib/responses.js";
import { prisma } from "../config/prisma.js";

export const healthController = {
  /** Infrastructure health: process + database connectivity. */
  async health(_req: Request, res: Response) {
    let database = "up";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }
    sendSuccess(res, {
      status: database === "up" ? "ok" : "degraded",
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  },

  /** Versioned API liveness probe. */
  async apiHealth(_req: Request, res: Response) {
    sendSuccess(res, { status: "ok", timestamp: new Date().toISOString() });
  },
};
