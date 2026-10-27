import { beforeAll, describe, expect, it } from "vitest";
import { api } from "./helpers.js";
import {
  APP_LOCK_CODE_LENGTH,
  APP_LOCK_WINDOW_MS,
  codeForWindow,
  windowAt,
} from "../src/services/app-lock.service.js";

/** Fresh sender IP per request — the throttle counts failures per IP. */
function asIp(ip: string) {
  // trust proxy = 1: the last X-Forwarded-For entry is the client address.
  return { "X-Forwarded-For": ip };
}

describe("App lock", () => {
  beforeAll(async () => {
    // No database tables involved — the lock is derived, not stored.
  });

  it("guards the code endpoint with the admin key", async () => {
    const app = await api();
    expect((await app.get("/api/v1/app-lock/code")).status).toBe(401);
    expect(
      (
        await app
          .get("/api/v1/app-lock/code")
          .set("x-admin-key", "not-the-key-at-all-not-the-key")
      ).status,
    ).toBe(401);
  });

  it("hands out the current window code to curl", async () => {
    const app = await api();
    const res = await app
      .get("/api/v1/app-lock/code")
      .set("x-admin-key", "phoenix-development-app-lock-admin-key");
    expect(res.status).toBe(200);

    const { code, windowIndex, startsAt, endsAt } = res.body.data;
    expect(code).toMatch(new RegExp(`^[A-Z0-9]{${APP_LOCK_CODE_LENGTH}}$`));
    expect(windowIndex).toBe(windowAt().index);
    expect(Date.parse(endsAt) - Date.parse(startsAt)).toBe(
      APP_LOCK_WINDOW_MS,
    );
    expect(Date.now()).toBeGreaterThanOrEqual(Date.parse(startsAt));
    expect(Date.now()).toBeLessThan(Date.parse(endsAt));

    // And that code actually unlocks.
    const verified = await app
      .post("/api/v1/app-lock/verify")
      .send({ code });
    expect(verified.status).toBe(200);
    expect(verified.body.data.windowIndex).toBe(windowIndex);
    expect(verified.body.data.endsAt).toBe(endsAt);
  });

  it("derives stable, per-window codes from a clean alphabet", () => {
    for (let index = 0; index < 50; index++) {
      expect(codeForWindow(index)).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
    expect(codeForWindow(0)).toBe(codeForWindow(0));
    expect(codeForWindow(0)).not.toBe(codeForWindow(1));
    expect(codeForWindow(2_000_000)).not.toBe(codeForWindow(2_000_001));
  });

  it("accepts lowercase or spaced input on verify", async () => {
    const app = await api();
    const code = codeForWindow(windowAt().index);
    const res = await app
      .post("/api/v1/app-lock/verify")
      .send({ code: code.toLowerCase() });
    expect(res.status).toBe(200);

    // Punctuation/whitespace is stripped too.
    const spaced = await app
      .post("/api/v1/app-lock/verify")
      .set(asIp("10.7.0.2"))
      .send({ code: `${code.slice(0, 3)}-${code.slice(3)}` });
    expect(spaced.status).toBe(200);
  });

  it("rejects a wrong code without leaking window info", async () => {
    const app = await api();
    const res = await app
      .post("/api/v1/app-lock/verify")
      .set(asIp("10.7.0.3"))
      .send({ code: "AAAAAA" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_UNLOCK_CODE");
  });

  it("throttles brute-force attempts per IP", async () => {
    const app = await api();
    const ip = "10.7.0.4";
    for (let attempt = 0; attempt < 10; attempt++) {
      const res = await app
        .post("/api/v1/app-lock/verify")
        .set(asIp(ip))
        .send({ code: `WRONG${attempt % 10}` });
      expect(res.status).toBe(401);
    }
    const throttled = await app
      .post("/api/v1/app-lock/verify")
      .set(asIp(ip))
      .send({ code: "WRONG9" });
    expect(throttled.status).toBe(429);
    expect(throttled.body.error.code).toBe("TOO_MANY_ATTEMPTS");

    // Another IP is untouched.
    const other = await app
      .post("/api/v1/app-lock/verify")
      .set(asIp("10.7.0.5"))
      .send({ code: "WRONG9" });
    expect(other.status).toBe(401);
  });
});
