import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, signIn, truncateAll, uniqueEmail } from "./helpers.js";

describe("Authentication", () => {
  beforeAll(async () => {
    await truncateAll();
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const app = await api();
    const res = await app.get("/api/v1/playlists");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("registers a user and returns a session", async () => {
    const email = uniqueEmail("auth");
    const user = await createUser("Auth Test", email);
    expect(user.cookie).not.toBe("");
    expect(user.role).toBe("USER");
  });

  it("allows an authenticated user to access protected routes", async () => {
    const email = uniqueEmail("authed");
    const user = await createUser("Authed User", email);
    const app = await api();

    const res = await app.get("/api/v1/playlists").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("restores the session via get-session (app restart scenario)", async () => {
    const email = uniqueEmail("restore");
    const user = await createUser("Restore User", email);
    const app = await api();

    const res = await app.get("/api/v1/auth/get-session").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.session).toBeTruthy();
  });

  it("signs in an existing user", async () => {
    const email = uniqueEmail("signin");
    await createUser("Sign In User", email);
    const cookie = await signIn(email);
    expect(cookie).not.toBe("");
  });

  it("rejects sign-in with a wrong password", async () => {
    const email = uniqueEmail("wrongpw");
    await createUser("Wrong PW User", email);
    const app = await api();

    const res = await app
      
      .post("/api/v1/auth/sign-in/email")
      .send({ email, password: "wrong-password" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("invalidates the session after sign-out", async () => {
    const email = uniqueEmail("signout");
    const user = await createUser("Sign Out User", email);
    const app = await api();

    const res = await app.post("/api/v1/auth/sign-out").set("Cookie", user.cookie);
    expect([200, 204]).toContain(res.status);

    // The session record must be gone from the database. (get-session with a
    // stale cookieCache cookie may still return cached data for maxAge seconds;
    // a real client discards its cookies when sign-out clears them.)
    const { prisma } = await import("../src/config/prisma.js");
    const sessions = await prisma.session.count({ where: { userId: user.userId } });
    expect(sessions).toBe(0);
  });
});
