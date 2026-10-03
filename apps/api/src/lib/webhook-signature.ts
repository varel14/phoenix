import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * HMAC-SHA256 signing shared by real provider adapters and the dev-confirm
 * endpoint (which pipes through the exact same webhook pipeline).
 */
export function signWebhookPayload(payload: string | Buffer, secret: string = env.PAYMENT_WEBHOOK_SECRET): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string | undefined,
  secret: string = env.PAYMENT_WEBHOOK_SECRET,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signWebhookPayload(payload, secret), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
