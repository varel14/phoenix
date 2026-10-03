import "dotenv/config";
import { z } from "zod";

/** Treats empty/blank env values as unset (optional fields). */
function emptyAsUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );
}

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
  /** Folder of local images served at GET /thumbnails (relative to apps/api). */
  THUMBNAILS_DIR: z.string().default("../thumbnails"),
  /** Folder of user-uploaded public files served at GET /uploads (relative to apps/api). */
  UPLOADS_DIR: z.string().default("../uploads"),
  /** Folder of protected digital product files (never served statically). */
  DIGITAL_FILES_DIR: z.string().default("../digital-files"),
  /** Active payment provider identifier (see lib/payment-providers). */
  PAYMENT_PROVIDER: z.string().default("simulated"),
  /** HMAC secret used to verify payment provider webhooks. */
  PAYMENT_WEBHOOK_SECRET: z
    .string()
    .min(32, "PAYMENT_WEBHOOK_SECRET must be at least 32 characters (generate one with: openssl rand -base64 32)")
    .optional()
    .transform((value) => {
      if (value) return value;
      if (process.env["NODE_ENV"] === "production") {
        throw new Error("PAYMENT_WEBHOOK_SECRET is required in production");
      }
      return "phoenix-development-webhook-secret-do-not-use";
    }),
  /** Max accepted upload size in megabytes. */
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  /** How long an unanswered call keeps ringing (ms) before the server marks it MISSED. */
  RING_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  /**
   * TURN relay for WebRTC calls — without one, direct P2P fails behind
   * symmetric NAT / carrier CGNAT. Comma-separated relay URLs, e.g.
   * "turn:turn.example.com:3478,turns:turn.example.com:5349".
   */
  TURN_URL: emptyAsUndefined(z.string().min(1)),
  /** Static long-term TURN credentials (coturn lt-cred-mech). */
  TURN_USERNAME: emptyAsUndefined(z.string().min(1)),
  TURN_CREDENTIAL: emptyAsUndefined(z.string().min(1)),
  /** coturn "use-auth-secret" shared secret — time-limited HMAC credentials, preferred over static ones. */
  TURN_AUTH_SECRET: emptyAsUndefined(z.string().min(1)),
  /** Lifetime of TURN REST API credentials, in seconds. */
  TURN_CREDENTIAL_TTL_SEC: z.coerce.number().int().positive().default(3600),
  /** Expo push service access token (EAS dashboard). Optional: without it pushes still deliver at a lower rate. */
  EXPO_PUSH_ACCESS_TOKEN: emptyAsUndefined(z.string().min(1)),
  /**
   * Cloudflare R2 (S3-compatible) object storage. When all four credentials
   * are set, uploads are stored in the bucket and public media is served
   * straight from R2_PUBLIC_BASE_URL; otherwise files stay on local disk.
   */
  R2_ACCOUNT_ID: emptyAsUndefined(z.string().min(1)),
  R2_ACCESS_KEY_ID: emptyAsUndefined(z.string().min(1)),
  R2_SECRET_ACCESS_KEY: emptyAsUndefined(z.string().min(1)),
  R2_BUCKET: emptyAsUndefined(z.string().min(1)),
  /** Public base URL of the bucket (https://pub-<id>.r2.dev or a custom domain), no trailing slash. */
  R2_PUBLIC_BASE_URL: emptyAsUndefined(z.string().url()).transform((value) => value?.replace(/\/+$/, "")),
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
