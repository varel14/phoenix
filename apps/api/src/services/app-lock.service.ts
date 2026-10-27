import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

/**
 * App lock: the whole application blocks itself at the start of every 3-day
 * window until someone enters that window's 6-character unlock code. Codes are
 * derived deterministically (HMAC of the window index) so there is nothing to
 * store — the owner reads the current code with curl (GET /app-lock/code,
 * guarded by APP_LOCK_ADMIN_KEY) and hands it to the device in front of them.
 */

/** Length of one lock window, in ms (3 days). */
export const APP_LOCK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Code length in characters. */
export const APP_LOCK_CODE_LENGTH = 6;

/**
 * Uppercase alphanumeric alphabet with the easily-confused characters
 * (I, L, O, 0, 1) removed, so a code read aloud or copied by hand is
 * unambiguous.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface LockWindow {
  /** Monotonic window index — changes every APP_LOCK_WINDOW_MS. */
  index: number;
  startsAt: Date;
  endsAt: Date;
}

/** The 3-day window a timestamp falls into (aligned on the epoch). */
export function windowAt(timestamp = Date.now()): LockWindow {
  const index = Math.floor(timestamp / APP_LOCK_WINDOW_MS);
  return {
    index,
    startsAt: new Date(index * APP_LOCK_WINDOW_MS),
    endsAt: new Date((index + 1) * APP_LOCK_WINDOW_MS),
  };
}

/** The unlock code for a given window — stable for the whole window. */
export function codeForWindow(index: number): string {
  const digest = createHmac("sha256", env.APP_LOCK_SECRET)
    .update(`phoenix-app-lock:v1:${index}`)
    .digest();
  let code = "";
  for (let i = 0; i < APP_LOCK_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[(digest[i] ?? 0) % CODE_ALPHABET.length];
  }
  return code;
}

/** Normalizes typed input: uppercase, punctuation/whitespace stripped. */
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export interface AppLockStatus {
  code: string;
  window: LockWindow;
}

/** The code an administrator would hand out right now. */
export function getCurrentCode(now = Date.now()): AppLockStatus {
  const window = windowAt(now);
  return { code: codeForWindow(window.index), window };
}

/**
 * Checks an entered code against the current window. On success returns the
 * window the device should consider unlocked — the unlock only lasts until
 * `window.endsAt`, then the next code is required.
 */
export function verifyCode(
  rawCode: string,
  ip: string,
  now = Date.now(),
): { windowIndex: number; endsAt: Date } {
  const window = windowAt(now);
  const expected = codeForWindow(window.index);
  const entered = normalizeCode(rawCode);
  if (
    entered.length !== APP_LOCK_CODE_LENGTH ||
    !timingSafeEqual(Buffer.from(entered), Buffer.from(expected))
  ) {
    throttleFailure(ip, now);
    throw new AppError(401, "INVALID_UNLOCK_CODE", "Code invalide");
  }
  return { windowIndex: window.index, endsAt: window.endsAt };
}

// ------------------------------------------------------------- throttling
// In-memory per-IP failure counter: enough to make the ~31^6 code space
// unbrute-forceable over the network. Resets with the process — acceptable
// for a lock whose codes rotate every 3 days anyway.

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const failures = new Map<string, { count: number; resetAt: number }>();

function throttleFailure(ip: string, now: number): void {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= now) {
    failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_FAILURES) {
    const retryInSec = Math.ceil((entry.resetAt - now) / 1000);
    throw new AppError(
      429,
      "TOO_MANY_ATTEMPTS",
      `Trop de tentatives — réessayez dans ${Math.ceil(retryInSec / 60)} min`,
    );
  }
}

/** Milliseconds until the given ip may try again (0 when not throttled). */
export function throttledForMs(ip: string, now = Date.now()): number {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= now) return 0;
  return entry.resetAt - now;
}

/** Drops expired counters so the map cannot grow without bound. */
export function sweepThrottle(now = Date.now()): void {
  for (const [ip, entry] of failures) {
    if (entry.resetAt <= now) failures.delete(ip);
  }
}
