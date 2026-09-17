import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (generate one with: openssl rand -base64 32)")
    .optional()
    .transform((value) => {
      if (value) return value;
      if (process.env["NODE_ENV"] === "production") {
        throw new Error("BETTER_AUTH_SECRET is required in production");
      }
      // Development fallback so the app boots without a configured secret.
      return "phoenix-development-secret-do-not-use-in-prod";
    }),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
  CORS_ORIGIN: z.string().default("*"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const data = parsed.data;

const corsOrigins = data.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  ...data,
  isDevelopment: data.NODE_ENV === "development",
  isTest: data.NODE_ENV === "test",
  isProduction: data.NODE_ENV === "production",
  corsOrigins,
} as const;

export type Env = typeof env;
