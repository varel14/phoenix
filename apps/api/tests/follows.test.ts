import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, uniqueEmail } from "./helpers.js";
import { prisma } from "../src/config/prisma.js";

describe("User follows", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE users, sessions, accounts, verifications,
       conversations, conversation_participants, messages, message_attachments, calls,
       wallets, wallet_transactions, user_follows CASCADE`,
    );
  });

  it("follows, flags mutuality once followed back, and unfollows", async () => {
    const awa = await createUser("Awa", uniqueEmail("awa-follow"));
    const issa = await createUser("Issa", uniqueEmail("issa-follow"));
    const app = await api();

    // Awa follows Issa — one-way, not mutual yet.
    const follow = await app
      .post(`/api/v1/users/${issa.userId}/follow`)
      .set("Cookie", awa.cookie);
    expect(follow.status).toBe(201);
    // New follows are requests: PENDING until the recipient accepts.
    expect(follow.body.data).toEqual({
      status: "pending",
      followsMe: false,
      isMutual: false,
      isFollowing: true,
    });

    // Issa follows back — mutuality flips on for both sides.
    await app
      .post(`/api/v1/users/${awa.userId}/follow`)
      .set("Cookie", issa.cookie);
    const awaFollowing = await app
      .get("/api/v1/users/following")
      .set("Cookie", awa.cookie);
    expect(awaFollowing.status).toBe(200);
    expect(awaFollowing.body.data).toHaveLength(1);
    expect(awaFollowing.body.data[0]).toMatchObject({
      id: issa.userId,
      name: "Issa",
      isMutual: true,
    });

    // Unfollow removes the link and reports the cleared state.
    const unfollow = await app
      .delete(`/api/v1/users/${issa.userId}/follow`)
      .set("Cookie", awa.cookie);
    expect(unfollow.status).toBe(200);
    expect(unfollow.body.data).toEqual({
      status: "none",
      followsMe: false,
      isMutual: false,
      isFollowing: false,
    });
    const empty = await app
      .get("/api/v1/users/following")
      .set("Cookie", awa.cookie);
    expect(empty.body.data).toHaveLength(0);
  });

  it("rejects self-follows, unknown targets and unfollowing a non-follow", async () => {
    const user = await createUser("Solo", uniqueEmail("solo-follow"));
    const stranger = await createUser("Ghost", uniqueEmail("ghost-follow"));
    const app = await api();

    expect(
      (
        await app
          .post(`/api/v1/users/${user.userId}/follow`)
          .set("Cookie", user.cookie)
      ).status,
    ).toBe(400);
    expect(
      (
        await app
          .post("/api/v1/users/not-a-real-id/follow")
          .set("Cookie", user.cookie)
      ).status,
    ).toBe(404);
    await app
      .post(`/api/v1/users/${stranger.userId}/follow`)
      .set("Cookie", user.cookie);
    await app
      .delete(`/api/v1/users/${stranger.userId}/follow`)
      .set("Cookie", user.cookie);
    expect(
      (
        await app
          .delete(`/api/v1/users/${stranger.userId}/follow`)
          .set("Cookie", user.cookie)
      ).status,
    ).toBe(404);
  });

  it("is idempotent when following the same person twice", async () => {
    const fatou = await createUser("Fatou", uniqueEmail("fatou-follow"));
    const marc = await createUser("Marc", uniqueEmail("marc-follow"));
    const app = await api();

    await app
      .post(`/api/v1/users/${marc.userId}/follow`)
      .set("Cookie", fatou.cookie);
    const again = await app
      .post(`/api/v1/users/${marc.userId}/follow`)
      .set("Cookie", fatou.cookie);
    expect(again.status).toBe(201);
    expect(again.body.data).toEqual({
      status: "pending",
      followsMe: false,
      isMutual: false,
      isFollowing: true,
    });
    expect(
      await prisma.userFollow.count({ where: { followerId: fatou.userId } }),
    ).toBe(1);
  });

  it("orders wallet recipients: mutual follows, then contacts, and flags follow state", async () => {
    const nina = await createUser("Nina", uniqueEmail("nina-recip2"));
    const mutual = await createUser("Mutual Pal", uniqueEmail("mutual-pal"));
    const oneWay = await createUser("One Way", uniqueEmail("one-way"));
    const stranger = await createUser("Aloof Stranger", uniqueEmail("aloof-2"));
    const app = await api();

    await app
      .post(`/api/v1/users/${mutual.userId}/follow`)
      .set("Cookie", nina.cookie);
    await app
      .post(`/api/v1/users/${nina.userId}/follow`)
      .set("Cookie", mutual.cookie);
    await app
      .post(`/api/v1/users/${oneWay.userId}/follow`)
      .set("Cookie", nina.cookie);

    const recipients = await app
      .get("/api/v1/wallet/recipients")
      .set("Cookie", nina.cookie);
    expect(recipients.status).toBe(200);
    const ids = recipients.body.data.map((r: { id: string }) => r.id);
    expect(ids.indexOf(mutual.userId)).toBeLessThan(ids.indexOf(oneWay.userId));
    expect(ids).not.toContain(stranger.userId);
    const byId = new Map(
      recipients.body.data.map((r: { id: string }) => [r.id, r]),
    );
    expect(byId.get(mutual.userId)).toMatchObject({
      isFollowing: true,
      isMutual: true,
    });
    expect(byId.get(oneWay.userId)).toMatchObject({
      isFollowing: true,
      isMutual: false,
    });

    // A searched stranger carries negative follow flags.
    const searched = await app
      .get("/api/v1/wallet/recipients?search=Aloof")
      .set("Cookie", nina.cookie);
    const found = searched.body.data.find(
      (r: { id: string }) => r.id === stranger.userId,
    );
    expect(found).toMatchObject({ isFollowing: false, isMutual: false });

    // Trigram search survives mistyping ("Aloof" -> "Alof").
    const mistyped = await app
      .get("/api/v1/wallet/recipients?search=Alof")
      .set("Cookie", nina.cookie);
    expect(mistyped.body.data.map((r: { id: string }) => r.id)).toContain(
      stranger.userId,
    );
  });

  it("surfaces follow state on the transaction detail counterparty", async () => {
    const sender = await createUser("Sena", uniqueEmail("sena-detail"));
    const peer = await createUser("Papi", uniqueEmail("papi-detail"));
    const app = await api();

    await app
      .post(`/api/v1/users/${peer.userId}/follow`)
      .set("Cookie", sender.cookie);

    const topup = await app
      .post("/api/v1/wallet/topups")
      .set("Cookie", sender.cookie)
      .send({ amount: 500 });
    await app
      .post(
        `/api/v1/wallet/topups/${topup.body.data.transaction.reference}/dev-confirm`,
      )
      .set("Cookie", sender.cookie);
    const transfer = await app
      .post("/api/v1/wallet/transfers")
      .set("Cookie", sender.cookie)
      .send({ recipientId: peer.userId, amount: 100 });

    const detail = await app
      .get(`/api/v1/wallet/transactions/${transfer.body.data.transaction.id}`)
      .set("Cookie", sender.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.counterparty).toMatchObject({
      id: peer.userId,
      isFollowing: true,
      isMutual: false,
    });

    // Following back flips the mutual flag on the same endpoint.
    await app
      .post(`/api/v1/users/${sender.userId}/follow`)
      .set("Cookie", peer.cookie);
    const detailAgain = await app
      .get(`/api/v1/wallet/transactions/${transfer.body.data.transaction.id}`)
      .set("Cookie", sender.cookie);
    expect(detailAgain.body.data.counterparty).toMatchObject({
      isFollowing: true,
      isMutual: true,
    });
  });
});
