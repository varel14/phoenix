import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, uniqueEmail, type TestUser } from "./helpers.js";
import { prisma } from "../src/config/prisma.js";

/** Chat creation requires a mutual follow — wire one up for test users. */
async function establishMutual(
  app: Awaited<ReturnType<typeof api>>,
  a: TestUser,
  b: TestUser,
) {
  await app.post(`/api/v1/users/${b.userId}/follow`).set("Cookie", a.cookie);
  await app.post(`/api/v1/users/${a.userId}/follow`).set("Cookie", b.cookie);
}

describe("SCL conversations", () => {
  beforeAll(async () => {
    // Truncate is handled globally per-suite by the shared database; the
    // authorization test file truncates before auth checks.
    await prisma.$executeRawUnsafe(
      `TRUNCATE conversations, conversation_participants, messages, message_attachments, calls CASCADE`,
    );
  });

  it("creates a direct conversation and deduplicates it", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice"));
    const bob = await createUser("Bob", uniqueEmail("bob"));
    const app = await api();

    const created = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId });
    expect(created.status).toBe(201);
    expect(created.body.data.type).toBe("DIRECT");
    expect(created.body.data.participants).toHaveLength(2);

    const again = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId });
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe(created.body.data.id);
  });

  it("rejects conversations with an unknown recipient", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-x"));
    const app = await api();
    const res = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: "5c1f3a52-9d3e-4e79-9bb5-33aa4d64a862" });
    expect(res.status).toBe(404);
  });

  it("blocks access for non-participants", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-sec"));
    const bob = await createUser("Bob", uniqueEmail("bob-sec"));
    const mallory = await createUser("Mallory", uniqueEmail("mallory"));
    const app = await api();

    const created = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId });
    const conversationId = created.body.data.id;

    const detail = await app
      .get(`/api/v1/conversations/${conversationId}`)
      .set("Cookie", mallory.cookie);
    expect(detail.status).toBe(403);

    const messages = await app
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", mallory.cookie);
    expect(messages.status).toBe(403);

    const send = await app
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", mallory.cookie)
      .send({ type: "TEXT", content: "intrusion" });
    expect(send.status).toBe(403);
  });

  it("sends, lists and reads messages", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-msg"));
    const bob = await createUser("Bob", uniqueEmail("bob-msg"));
    const app = await api();

    const conversation = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId });
    const conversationId = conversation.body.data.id;

    const sent = await app
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", alice.cookie)
      .send({ type: "TEXT", content: "Salut Bob !" });
    expect(sent.status).toBe(201);
    expect(sent.body.data.content).toBe("Salut Bob !");

    // Bob sees one unread conversation.
    const bobList = await app
      .get("/api/v1/conversations")
      .set("Cookie", bob.cookie);
    expect(bobList.status).toBe(200);
    expect(bobList.body.data[0].unreadCount).toBe(1);
    expect(bobList.body.data[0].lastMessage.content).toBe("Salut Bob !");

    // Mark read clears the unread counter.
    const read = await app
      .post(`/api/v1/conversations/${conversationId}/read`)
      .set("Cookie", bob.cookie);
    expect(read.status).toBe(200);

    const bobListAfter = await app
      .get("/api/v1/conversations")
      .set("Cookie", bob.cookie);
    expect(bobListAfter.body.data[0].unreadCount).toBe(0);

    // Pagination: newest first.
    const messages = await app
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", alice.cookie);
    expect(messages.status).toBe(200);
    expect(messages.body.data).toHaveLength(1);
  });

  it("stores voice message metadata", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-voice"));
    const bob = await createUser("Bob", uniqueEmail("bob-voice"));
    const app = await api();
    const conversation = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId });
    const conversationId = conversation.body.data.id;

    const sent = await app
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", alice.cookie)
      .send({
        type: "VOICE",
        attachment: {
          url: "/uploads/abc123.m4a",
          storageKey: "abc123.m4a",
          mimeType: "audio/m4a",
          durationSec: 12,
          fileSizeBytes: 48000,
        },
      });
    expect(sent.status).toBe(201);
    expect(sent.body.data.type).toBe("VOICE");
    expect(sent.body.data.attachment.durationSec).toBe(12);
    expect(sent.body.data.attachment.storageKey).toBe("abc123.m4a");
  });

  it("stores image and file messages with attachment metadata", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-media"));
    const bob = await createUser("Bob", uniqueEmail("bob-media"));
    const app = await api();
    const conversation = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId });
    const conversationId = conversation.body.data.id;

    const photo = await app
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", alice.cookie)
      .send({
        type: "IMAGE",
        content: "Regarde ça",
        attachment: {
          url: "/uploads/img123.jpg",
          storageKey: "img123.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 120000,
        },
      });
    expect(photo.status).toBe(201);
    expect(photo.body.data.type).toBe("IMAGE");
    expect(photo.body.data.content).toBe("Regarde ça");

    const file = await app
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", alice.cookie)
      .send({
        type: "FILE",
        attachment: {
          url: "/uploads/doc123.pdf",
          storageKey: "doc123.pdf",
          mimeType: "application/pdf",
          name: "contrat.pdf",
        },
      });
    expect(file.status).toBe(201);
    expect(file.body.data.type).toBe("FILE");
    expect(file.body.data.attachment.name).toBe("contrat.pdf");

    // Attachment types without an attachment payload are rejected.
    const invalid = await app
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", alice.cookie)
      .send({ type: "IMAGE" });
    expect(invalid.status).toBe(400);
  });

  it("creates call records with caller/recipient authorization", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-call"));
    const bob = await createUser("Bob", uniqueEmail("bob-call"));
    const mallory = await createUser("Mallory", uniqueEmail("mallory-call"));

    const call = await prisma.call.create({
      data: { callerId: alice.userId, recipientId: bob.userId, type: "AUDIO" },
    });

    // Both parties can see the call in history.
    const app = await api();
    const aliceCalls = await app
      .get("/api/v1/calls")
      .set("Cookie", alice.cookie);
    expect(aliceCalls.status).toBe(200);
    expect(
      aliceCalls.body.data.some(
        (entry: { id: string }) => entry.id === call.id,
      ),
    ).toBe(true);

    const bobCalls = await app.get("/api/v1/calls").set("Cookie", bob.cookie);
    expect(
      bobCalls.body.data.some((entry: { id: string }) => entry.id === call.id),
    ).toBe(true);

    // Mallory cannot see it.
    const malloryCalls = await app
      .get("/api/v1/calls")
      .set("Cookie", mallory.cookie);
    expect(
      malloryCalls.body.data.some(
        (entry: { id: string }) => entry.id === call.id,
      ),
    ).toBe(false);
  });

  it("searches users for the conversation picker", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-search"));
    await createUser("Zoé Dupont", uniqueEmail("zoe"));
    const app = await api();

    const res = await app
      .get("/api/v1/conversations/users?search=Zo")
      .set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    expect(
      res.body.data.some(
        (user: { name: string }) => user.name === "Zoé Dupont",
      ),
    ).toBe(true);
    expect(
      res.body.data.some((user: { name: string }) => user.name === "Alice"),
    ).toBe(false);
  });

  it("returns a default contact list when the picker search is empty", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-empty"));
    await createUser("Default Contact", uniqueEmail("default-contact"));
    const app = await api();

    const res = await app
      .get("/api/v1/conversations/users?search=")
      .set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    expect(
      res.body.data.some(
        (user: { name: string }) => user.name === "Default Contact",
      ),
    ).toBe(true);
  });

  it("finds users despite typos (trigram matching)", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-trgm"));
    await createUser("Boubacar Sylla", uniqueEmail("boubacar"));
    const app = await api();

    const res = await app
      .get("/api/v1/conversations/users?search=Boubacar%20Silah")
      .set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    expect(
      res.body.data.some(
        (user: { name: string }) => user.name === "Boubacar Sylla",
      ),
    ).toBe(true);
  });

  it("creates draft conversations that promote on the first message", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-draft"));
    const bob = await createUser("Bob", uniqueEmail("bob-draft"));
    const app = await api();

    const draft = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId, draft: true });
    expect(draft.status).toBe(201);
    expect(draft.body.data.isDraft).toBe(true);

    // Sending the first message promotes the draft to a real conversation.
    const sent = await app
      .post(`/api/v1/conversations/${draft.body.data.id}/messages`)
      .set("Cookie", alice.cookie)
      .send({ type: "TEXT", content: "Bonjour Bob !" });
    expect(sent.status).toBe(201);

    const list = await app
      .get("/api/v1/conversations")
      .set("Cookie", alice.cookie);
    const row = list.body.data.find(
      (c: { id: string }) => c.id === draft.body.data.id,
    );
    expect(row.isDraft).toBe(false);
    expect(row.lastMessage.content).toBe("Bonjour Bob !");
  });

  it("delivers the payload message when creating over an existing conversation", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-atomic"));
    const bob = await createUser("Bob", uniqueEmail("bob-atomic"));
    const app = await api();

    const first = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({
        recipientId: bob.userId,
        message: { type: "TEXT", content: "Premier message" },
      });
    expect(first.status).toBe(201);
    expect(first.body.data.isDraft).toBe(false);

    const thread = await app
      .get(`/api/v1/conversations/${first.body.data.id}/messages`)
      .set("Cookie", alice.cookie);
    expect(
      thread.body.data.some(
        (m: { content: string }) => m.content === "Premier message",
      ),
    ).toBe(true);
  });

  it("finds conversations by message content with typos (trigram matching)", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-trgm-msg"));
    const bob = await createUser("Bob", uniqueEmail("bob-trgm-msg"));
    const app = await api();

    const created = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId });
    await app
      .post(`/api/v1/conversations/${created.body.data.id}/messages`)
      .set("Cookie", alice.cookie)
      .send({
        type: "TEXT",
        content: "On se retrouve au marché de Cocody demain",
      });

    const res = await app
      .get("/api/v1/conversations?search=marche%20de%20Cocodi")
      .set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    expect(
      res.body.data.some((c: { id: string }) => c.id === created.body.data.id),
    ).toBe(true);
  });

  it("arrives as a message request until the recipient accepts", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-req"));
    const bob = await createUser("Bob", uniqueEmail("bob-req"));
    const app = await api();

    const created = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId, message: { type: "TEXT", content: "Bonjour, je te contacte" } });
    expect(created.status).toBe(201);

    // Recipient: pending request (acceptedAt null on their membership).
    const member = await prisma.conversationParticipant.findFirst({
      where: { conversationId: created.body.data.id, userId: bob.userId },
    });
    expect(member?.acceptedAt).toBeNull();

    // Initiator engaged immediately.
    const initiator = await prisma.conversationParticipant.findFirst({
      where: { conversationId: created.body.data.id, userId: alice.userId },
    });
    expect(initiator?.acceptedAt).not.toBeNull();

    const accept = await app
      .post(`/api/v1/conversations/${created.body.data.id}/accept`)
      .set("Cookie", bob.cookie);
    expect(accept.status).toBe(200);
    expect(accept.body.data.accepted).toBe(true);
  });

  it("hides a conversation with the X button and re-shows on a new message", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-hide"));
    const bob = await createUser("Bob", uniqueEmail("bob-hide"));
    const app = await api();

    const created = await app
      .post("/api/v1/conversations")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId, message: { type: "TEXT", content: "Coucou" } });

    // Bob dismisses the request with the X button.
    const hide = await app
      .post(`/api/v1/conversations/${created.body.data.id}/hide`)
      .set("Cookie", bob.cookie);
    expect(hide.status).toBe(200);

    let list = await app.get("/api/v1/conversations").set("Cookie", bob.cookie);
    expect(list.body.data.some((c: { id: string }) => c.id === created.body.data.id)).toBe(false);

    // A new incoming message re-shows the conversation.
    await app
      .post(`/api/v1/conversations/${created.body.data.id}/messages`)
      .set("Cookie", alice.cookie)
      .send({ type: "TEXT", content: "Re-coucou" });
    list = await app.get("/api/v1/conversations").set("Cookie", bob.cookie);
    expect(list.body.data.some((c: { id: string }) => c.id === created.body.data.id)).toBe(true);
  });

  it("matches contacts by phone number (typo-proof suffix matching)", async () => {
    const suffix = String(Date.now()).slice(-8);
    const alice = await createUser("Alice", uniqueEmail("alice-match"));
    await prisma.user.update({
      where: { id: alice.userId },
      data: { phone: `+225 07 88 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)} ${suffix.slice(4)}` },
    });
    const bob = await createUser("Bob", uniqueEmail("bob-match"));
    await prisma.user.update({
      where: { id: bob.userId },
      data: { phone: `+225 01 42 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)} ${suffix.slice(4)}` },
    });
    const app = await api();

    // Formatted differently + country-code variants still match.
    const res = await app
      .post("/api/v1/conversations/match-contacts")
      .set("Cookie", alice.cookie)
      .send({ phones: [`+225 01 42 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)} ${suffix.slice(4)}`, `0788${suffix}`, "+33 6 00 00 00 00"] });
    expect(res.status).toBe(200);
    const matched = res.body.data.map((u: { id: string }) => u.id);
    expect(matched).toContain(bob.userId);
    expect(matched).not.toContain(alice.userId);
  });
});
