import { randomBytes } from "node:crypto";

/** Human-readable unique reference, e.g. "PHX-PAY-LZ2K4F1A9B". */
export function generateReference(prefix: string): string {
  const random = randomBytes(5).toString("hex").toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${random}`;
}

export const PAYMENT_REFERENCE_PREFIX = "PHX-PAY";
export const WALLET_REFERENCE_PREFIX = "PHX-WAL";
export const ORDER_REFERENCE_PREFIX = "PHX-CMD";
export const SUBSCRIPTION_REFERENCE_PREFIX = "CHY-ABO";
export const ROYALTY_REFERENCE_PREFIX = "CHY-RED";
