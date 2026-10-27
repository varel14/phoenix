import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.corsOrigins.includes("*")
    ? (request) => {
        // Development convenience: allow whatever Origin the request carries.
        // (better-auth always trusts its own baseURL; this only adds extras.)
        if (!env.isProduction) {
          const origin = request?.headers?.get("origin");
          return origin ? [origin] : [];
        }
        return env.corsOrigins.filter((allowed) => allowed !== "*");
      }
    : env.corsOrigins,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days — mobile clients should stay signed in
    // NOTE: cookieCache is intentionally disabled — it would serve a stale
    // user.role for up to maxAge after a user becomes an artist, breaking
    // authorization on the very next request.
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "USER",
        input: false, // role is only changed server-side (artist onboarding)
      },
      // WhatsApp-style identity: chats are reachable by phone number.
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  advanced: {
    cookiePrefix: "phoenix",
    // React Native clients send no Origin header; better-auth's CSRF origin
    // check would otherwise reject every authenticated mutation. CSRF remains
    // a browser-only threat — CORS still protects web deployments.
    disableCSRFCheck: true,
  },
});

export type Session = typeof auth.$Infer.Session;
