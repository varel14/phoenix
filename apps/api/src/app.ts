import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env.js";
import { auth } from "./lib/auth.js";
import { apiRouter } from "./routes/index.js";
import { healthController } from "./controllers/health.controller.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins.includes("*") ? true : env.corsOrigins,
      credentials: true,
    }),
  );

  // Better Auth must be mounted before body parsing: it reads the raw body
  // stream itself. Express 5 uses the "*splat" wildcard syntax.
  app.all("/api/v1/auth/*splat", toNodeHandler(auth));
  app.all("/api/v1/auth", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.isProduction ? "combined" : "dev"));

  // Infrastructure health (unversioned) + versioned API
  app.get("/health", healthController.health);
  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
