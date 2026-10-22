import { beforeAll, describe, expect, it } from "vitest";
import {
  api,
  createUser,
  signIn,
  truncateAll,
  uniqueEmail,
} from "./helpers.js";

describe("Follow requests and the mutual-follow chat gate", () => {
  let aliceEmail: string;
  let bobEmail: string;
  let aliceId: string;
  let bobId: string;

  beforeAll(async () => {
    await truncateAll();
    const alice = await createUser("Alice", uniqueEmail("gate-alice"));
    aliceEmail = alice.email;
    aliceId = alice.userId;
    const bob = await createUser("Bob", uniqueEmail("gate-bob"));
    bobEmail = bob.email;
    bobId = bob.userId;
  });

  it("creates a pending follow request (not mutual)", async () => {
    const app = await api();
    const cookie = await signIn(aliceEmail);

    const res = await app
      .post(`/api/v1/users/${bobId}/follow`)
      .set("Cookie", cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.isMutual).toBe(false);

    // Bob sees the pending request.
    const bobCookie = await signIn(bobEmail);
    const requests = await app
      .get("/api/v1/users/follow-requests")
      .set("Cookie", bobCookie);
    expect(requests.status).toBe(200);
    expect(
      requests.body.data.some((u: { id: string }) => u.id === aliceId),
    ).toBe(true);
  });

  it("blocks chat creation while the request is pending (FOLLOW_REQUIRED)", async () => {
    const app = await api();
    const cookie = await signIn(aliceEmail);

    const res = await app
      .post("/api/v1/conversations")
      .set("Cookie", cookie)
      .send({
        recipientId: bobId,
        message: { type: "TEXT", content: "Salut" },
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FOLLOW_REQUIRED");
  });

  it("accepting the request makes it mutual and unlocks chat", async () => {
    const app = await api();
    const aliceCookie = await signIn(aliceEmail);
    const bobCookie = await signIn(bobEmail);

    const accept = await app
      .post(`/api/v1/users/follow-requests/${aliceId}/accept`)
      .set("Cookie", bobCookie);
    expect(accept.status).toBe(200);

    const state = await app
      .get(`/api/v1/users/${bobId}/follow-state`)
      .set("Cookie", aliceCookie);
    expect(state.body.data.status).toBe("accepted");

    // Mutuality unlocks chat: Bob follows Alice back (auto-accepted).
    await app.post(`/api/v1/users/${aliceId}/follow`).set("Cookie", bobCookie);
    const mutual = await app
      .get(`/api/v1/users/${bobId}/follow-state`)
      .set("Cookie", aliceCookie);
    expect(mutual.body.data.isMutual).toBe(true);

    const res = await app
      .post("/api/v1/conversations")
      .set("Cookie", aliceCookie)
      .send({
        recipientId: bobId,
        message: { type: "TEXT", content: "Salut Bob !" },
      });
    expect(res.status).toBe(201);
  });

  it("exposes the follow state on conversation-picker results", async () => {
    const app = await api();
    const cookie = await signIn(bobEmail);

    // Bob follows Alice: her ACCEPTED edge toward him auto-accepts his request.
    await app.post(`/api/v1/users/${aliceId}/follow`).set("Cookie", cookie);
    const res = await app
      .get("/api/v1/conversations/users?search=Alice")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    const alice = res.body.data.find((u: { id: string }) => u.id === aliceId);
    expect(alice).toBeTruthy();
    expect(alice.follow).toBe("mutual");
  });

  it("auto-accepts when both sides request each other", async () => {
    const app = await api();
    const carla = await createUser("Carla", uniqueEmail("gate-carla"));
    const dave = await createUser("Dave", uniqueEmail("gate-dave"));
    const carlaCookie = await signIn(carla.email);
    const daveCookie = await signIn(dave.email);

    await app
      .post(`/api/v1/users/${dave.userId}/follow`)
      .set("Cookie", carlaCookie);
    const daveFollows = await app
      .post(`/api/v1/users/${carla.userId}/follow`)
      .set("Cookie", daveCookie);
    expect(daveFollows.status).toBe(201);
    // Dave's follow auto-accepts Carla's pending request: mutual instantly.
    expect(daveFollows.body.data.status).toBe("accepted");
    expect(daveFollows.body.data.isMutual).toBe(true);
  });

  it("rejecting removes the pending request", async () => {
    const app = await api();
    const eve = await createUser("Eve", uniqueEmail("gate-eve"));
    const zed = await createUser("Zed", uniqueEmail("gate-zed"));
    const eveCookie = await signIn(eve.email);
    const zedCookie = await signIn(zed.email);

    await app
      .post(`/api/v1/users/${zed.userId}/follow`)
      .set("Cookie", eveCookie);
    const reject = await app
      .delete(`/api/v1/users/follow-requests/${eve.userId}`)
      .set("Cookie", zedCookie);
    expect(reject.status).toBe(200);

    const requests = await app
      .get("/api/v1/users/follow-requests")
      .set("Cookie", zedCookie);
    expect(
      requests.body.data.some((u: { id: string }) => u.id === eve.userId),
    ).toBe(false);
  });
});
