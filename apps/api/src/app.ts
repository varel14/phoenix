import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env.js";
import { auth } from "./lib/auth.js";
import { thumbnailsDir } from "./lib/thumbnails.js";
import { uploadsDir } from "./lib/storage.js";
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

  // The raw body is kept for every JSON request so the payment webhook can
  // verify provider HMAC signatures (see payment.controller.webhook).
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(morgan(env.isProduction ? "combined" : "dev"));

  // Infrastructure health (unversioned) + versioned API
  app.get("/health", healthController.health);
  app.use("/api/v1", apiRouter);

  // Local image library referenced by seeded catalog content
  // (thumbnailUrl values are relative paths like /thumbnails/<file>).
  app.use(
    "/thumbnails",
    express.static(thumbnailsDir(), {
      maxAge: env.isProduction ? "7d" : 0,
    }),
  );

  // Public user uploads (voice notes, product images).
  app.use(
    "/uploads",
    express.static(uploadsDir(), {
      maxAge: env.isProduction ? "7d" : 0,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
