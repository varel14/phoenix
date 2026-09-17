import * as Crypto from "expo-crypto";

/** Client-generated UUIDs power idempotent offline event syncing. */
export function uuid(): string {
  return Crypto.randomUUID();
}
