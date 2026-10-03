import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server as IOServer } from "socket.io";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import { api, createUser, uniqueEmail, type TestUser } from "./helpers.js";
import { prisma } from "../src/config/prisma.js";
import { initRealtime } from "../src/lib/realtime.js";

// Long enough that the lifecycle tests always finish before expiry.
const RING_TIMEOUT_MS = 2500;

let httpServer: HttpServer;
let ioServer: IOServer;
let baseUrl: string;

beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE conversations, conversation_participants, messages, message_attachments, calls, sessions CASCADE`,
  );

  httpServer = createServer();
  ioServer = initRealtime(httpServer, { ringTimeoutMs: RING_TIMEOUT_MS });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  // Socket.IO owns the open sockets: close it first or httpServer.close() hangs.
  ioServer.disconnectSockets(true);
  await new Promise<void>((resolve) => ioServer.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

/** The socket middleware accepts the Better Auth session token or its signed form. */
function sessionTokenOf(user: TestUser): string {
  const match = user.cookie.match(/phoenix\.session_token=([^;]+)/);
  if (!match) throw new Error(`No session cookie for ${user.email}`);
  return decodeURIComponent(match[1]);
}

function connectAs(user: TestUser): Promise<ClientSocket> {
  const socket = ioClient(baseUrl, {
    transports: ["websocket"],
    auth: { sessionToken: sessionTokenOf(user) },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket connect timeout")), 5000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

type Ack<T = Record<string, unknown>> = T & { error?: string };

function emitAck<T = Ack>(socket: ClientSocket, event: string, payload: unknown, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ack of "${event}"`)), timeoutMs);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

async function closeSocket(socket: ClientSocket): Promise<void> {
  socket.disconnect();
}

interface CallPayload {
  id: string;
  type: "AUDIO" | "VIDEO";
  status: "RINGING" | "ACCEPTED" | "REJECTED" | "MISSED" | "ENDED" | "FAILED";
  callerId: string;
  recipientId: string;
}

interface MessagePayload {
  id: string;
  content: string | null;
  type: string;
  sender: { id: string };
}

describe("SCL realtime (socket.io)", () => {
  it("authenticates sockets and rejects unknown tokens", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-alice"));

    await expect(connectAs(alice)).resolves.toBeDefined();

    const bad = ioClient(baseUrl, { transports: ["websocket"], auth: { sessionToken: "garbage" } });
    await new Promise<void>((resolve) => {
      bad.on("connect_error", (error) => {
        expect(error.message).toBe("UNAUTHORIZED");
        bad.close();
        resolve();
      });
    });
  });

  it("delivers chat messages and read receipts between participants", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-chat-a"));
    const bob = await createUser("Bob", uniqueEmail("rt-chat-b"));
    const mallory = await createUser("Mallory", uniqueEmail("rt-chat-m"));
    const app = await api();

    const conversation = await app.post("/api/v1/conversations").set("Cookie", alice.cookie).send({ recipientId: bob.userId });
    const conversationId = conversation.body.data.id as string;

    const aliceSocket = await connectAs(alice);
    const bobSocket = await connectAs(bob);
    const mallorySocket = await connectAs(mallory);

    // Non-participants cannot join the room.
    const intruder = await emitAck(mallorySocket, "conversation:join", { conversationId });
    expect(intruder.error).toBeTruthy();

    await emitAck(aliceSocket, "conversation:join", { conversationId });
    await emitAck(bobSocket, "conversation:join", { conversationId });

    const bobGotNew = waitFor<{ conversationId: string; message: MessagePayload }>(bobSocket, "message:new");
    const bobGotReceived = waitFor<{ conversationId: string; message: MessagePayload }>(bobSocket, "message:received");
    const malloryGotNothing = new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 700);
      mallorySocket.once("message:new", () => reject(new Error("mallory saw a message")));
      mallorySocket.once("message:received", () => reject(new Error("mallory saw a message")));
    });

    const ack = await emitAck<{ message: MessagePayload }>(aliceSocket, "conversation:message", {
      conversationId,
      type: "TEXT",
      content: "Coucou depuis le socket",
    });
    expect(ack.error).toBeUndefined();
    expect(ack.message.content).toBe("Coucou depuis le socket");

    const [newEvent, receivedEvent] = await Promise.all([bobGotNew, bobGotReceived]);
    expect(newEvent.conversationId).toBe(conversationId);
    expect(newEvent.message.id).toBe(ack.message.id);
    expect(receivedEvent.message.id).toBe(ack.message.id);
    await malloryGotNothing;

    // The socket-sent message is persisted and visible over REST.
    const messages = await app.get(`/api/v1/conversations/${conversationId}/messages`).set("Cookie", bob.cookie);
    expect(messages.body.data.some((m: { id: string }) => m.id === ack.message.id)).toBe(true);

    // Read receipts fan out to the room.
    const aliceGotRead = waitFor<{ userId: string; lastReadAt: string }>(aliceSocket, "message:read");
    bobSocket.emit("conversation:read", { conversationId });
    const readEvent = await aliceGotRead;
    expect(readEvent.userId).toBe(bob.userId);

    await Promise.all([closeSocket(aliceSocket), closeSocket(bobSocket), closeSocket(mallorySocket)]);
  });

  it("rejects message sends with an invalid payload", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-badmsg"));
    const bob = await createUser("Bob", uniqueEmail("rt-badmsg-b"));
    const app = await api();
    const conversation = await app.post("/api/v1/conversations").set("Cookie", alice.cookie).send({ recipientId: bob.userId });

    const socket = await connectAs(alice);
    const ack = await emitAck(socket, "conversation:message", {
      conversationId: conversation.body.data.id,
      type: "TEXT",
      content: "",
    });
    expect(ack.error).toBe("Invalid message payload");
    await closeSocket(socket);
  });

  it("runs the full audio call lifecycle: ring, accept, relay, hang up", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-call-a"));
    const bob = await createUser("Bob", uniqueEmail("rt-call-b"));
    const mallory = await createUser("Mallory", uniqueEmail("rt-call-m"));

    const aliceSocket = await connectAs(alice);
    const bobSocket = await connectAs(bob);
    const mallorySocket = await connectAs(mallory);

    const bobIncoming = waitFor<{ call: CallPayload }>(bobSocket, "call:incoming");
    const mallorySilent = new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 700);
      mallorySocket.once("call:incoming", () => reject(new Error("mallory got an incoming call")));
    });

    const startAck = await emitAck<{ call: CallPayload }>(aliceSocket, "call:start", {
      recipientId: bob.userId,
      type: "AUDIO",
    });
    expect(startAck.error).toBeUndefined();
    expect(startAck.call.status).toBe("RINGING");
    expect(startAck.call.type).toBe("AUDIO");
    expect(startAck.call.callerId).toBe(alice.userId);

    const incoming = await bobIncoming;
    expect(incoming.call.id).toBe(startAck.call.id);
    await mallorySilent;
    const callId = startAck.call.id;

    // Only the recipient may accept.
    const callerAccept = await emitAck(aliceSocket, "call:accept", { callId });
    expect(callerAccept.error).toBeTruthy();
    const strangerAccept = await emitAck(mallorySocket, "call:accept", { callId });
    expect(strangerAccept.error).toBeTruthy();

    const aliceAccepted = waitFor<{ call: CallPayload }>(aliceSocket, "call:accepted");
    const bobAck = await emitAck<{ call: CallPayload }>(bobSocket, "call:accept", { callId });
    expect(bobAck.call.status).toBe("ACCEPTED");
    const acceptedEvent = await aliceAccepted;
    expect(acceptedEvent.call.id).toBe(callId);

    // WebRTC signaling relays strictly between the two parties.
    const bobOffer = waitFor<{ callId: string; fromUserId: string; sdp: string }>(bobSocket, "webrtc:offer");
    await emitAck(aliceSocket, "webrtc:offer", { callId, sdp: "offer-sdp" });
    const offer = await bobOffer;
    expect(offer.callId).toBe(callId);
    expect(offer.fromUserId).toBe(alice.userId);
    expect(offer.sdp).toBe("offer-sdp");

    const aliceIce = waitFor<{ candidate: unknown }>(aliceSocket, "webrtc:ice-candidate");
    await emitAck(bobSocket, "webrtc:ice-candidate", { callId, candidate: { candidate: "cand-1" } });
    const ice = await aliceIce;
    expect((ice.candidate as { candidate: string }).candidate).toBe("cand-1");

    const aliceAnswer = waitFor<{ sdp: string }>(aliceSocket, "webrtc:answer");
    await emitAck(bobSocket, "webrtc:answer", { callId, sdp: "answer-sdp" });
    expect((await aliceAnswer).sdp).toBe("answer-sdp");

    // A stranger cannot piggyback on the signaling of someone else's call.
    const strangerRelay = await emitAck(mallorySocket, "webrtc:offer", { callId, sdp: "evil" });
    expect(strangerRelay.error).toBeTruthy();

    // Hang up: both parties hear call:ended, row becomes ENDED.
    const aliceEnded = waitFor<{ call: CallPayload }>(aliceSocket, "call:ended");
    const bobEnded = waitFor<{ call: CallPayload }>(bobSocket, "call:ended");
    const endAck = await emitAck<{ call: CallPayload }>(aliceSocket, "call:end", { callId });
    expect(endAck.call.status).toBe("ENDED");
    const [endedA, endedB] = await Promise.all([aliceEnded, bobEnded]);
    expect(endedA.call.status).toBe("ENDED");
    expect(endedB.call.status).toBe("ENDED");

    const row = await prisma.call.findUnique({ where: { id: callId } });
    expect(row?.status).toBe("ENDED");
    expect(row?.endedAt).toBeTruthy();

    await Promise.all([closeSocket(aliceSocket), closeSocket(bobSocket), closeSocket(mallorySocket)]);
  });

  it("runs the video call lifecycle with rejection by the callee", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-vcall-a"));
    const bob = await createUser("Bob", uniqueEmail("rt-vcall-b"));

    const aliceSocket = await connectAs(alice);
    const bobSocket = await connectAs(bob);

    const bobIncoming = waitFor<{ call: CallPayload }>(bobSocket, "call:incoming");
    const startAck = await emitAck<{ call: CallPayload }>(aliceSocket, "call:start", {
      recipientId: bob.userId,
      type: "VIDEO",
    });
    expect(startAck.call.type).toBe("VIDEO");
    expect((await bobIncoming).call.type).toBe("VIDEO");
    const callId = startAck.call.id;

    const aliceRejected = waitFor<{ call: CallPayload }>(aliceSocket, "call:rejected");
    const rejectAck = await emitAck<{ call: CallPayload }>(bobSocket, "call:reject", { callId });
    expect(rejectAck.call.status).toBe("REJECTED");
    expect((await aliceRejected).call.status).toBe("REJECTED");

    const row = await prisma.call.findUnique({ where: { id: callId } });
    expect(row?.status).toBe("REJECTED");
    expect(row?.durationSec).toBe(0);

    // A terminal call cannot be accepted afterwards.
    const lateAccept = await emitAck(bobSocket, "call:accept", { callId });
    expect(lateAccept.error).toBeTruthy();

    await Promise.all([closeSocket(aliceSocket), closeSocket(bobSocket)]);
  });

  it("records a missed call when the caller hangs up while ringing", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-missed-a"));
    const bob = await createUser("Bob", uniqueEmail("rt-missed-b"));

    const aliceSocket = await connectAs(alice);
    const bobSocket = await connectAs(bob);

    const bobIncoming = waitFor<{ call: CallPayload }>(bobSocket, "call:incoming");
    const startAck = await emitAck<{ call: CallPayload }>(aliceSocket, "call:start", {
      recipientId: bob.userId,
      type: "AUDIO",
    });
    await bobIncoming;
    const callId = startAck.call.id;

    const aliceEnded = waitFor<{ call: CallPayload }>(aliceSocket, "call:ended");
    const endAck = await emitAck<{ call: CallPayload }>(aliceSocket, "call:end", { callId });
    expect(endAck.call.status).toBe("MISSED");
    expect((await aliceEnded).call.status).toBe("MISSED");

    const row = await prisma.call.findUnique({ where: { id: callId } });
    expect(row?.status).toBe("MISSED");
    expect(row?.durationSec).toBe(0);

    await Promise.all([closeSocket(aliceSocket), closeSocket(bobSocket)]);
  });

  it("expires an unanswered call after the ring timeout", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-ring-a"));
    const bob = await createUser("Bob", uniqueEmail("rt-ring-b"));

    const aliceSocket = await connectAs(alice);
    const bobSocket = await connectAs(bob);

    const startAck = await emitAck<{ call: CallPayload }>(aliceSocket, "call:start", {
      recipientId: bob.userId,
      type: "AUDIO",
    });
    const callId = startAck.call.id;

    // Nobody answers: both parties are told the call is over.
    const aliceEnded = waitFor<{ call: CallPayload }>(aliceSocket, "call:ended", RING_TIMEOUT_MS + 5000);
    const bobEnded = waitFor<{ call: CallPayload }>(bobSocket, "call:ended", RING_TIMEOUT_MS + 5000);
    const [endedA, endedB] = await Promise.all([aliceEnded, bobEnded]);
    expect(endedA.call.status).toBe("MISSED");
    expect(endedB.call.status).toBe("MISSED");

    const row = await prisma.call.findUnique({ where: { id: callId } });
    expect(row?.status).toBe("MISSED");
    expect(row?.endedAt).toBeTruthy();

    // The terminal call can no longer be accepted.
    const lateAccept = await emitAck(bobSocket, "call:accept", { callId });
    expect(lateAccept.error).toBeTruthy();

    await Promise.all([closeSocket(aliceSocket), closeSocket(bobSocket)]);
  });

  it("validates call inputs", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-val-a"));
    const socket = await connectAs(alice);

    const selfCall = await emitAck(socket, "call:start", { recipientId: alice.userId, type: "AUDIO" });
    expect(selfCall.error).toBe("You cannot call yourself");

    const unknown = await emitAck(socket, "call:start", {
      recipientId: "5c1f3a52-9d3e-4e79-9bb5-33aa4d64a862",
      type: "AUDIO",
    });
    expect(unknown.error).toBe("User not found");

    const missing = await emitAck(socket, "call:start", { type: "AUDIO" });
    expect(missing.error).toBe("recipientId is required");

    await closeSocket(socket);
  });

  it("shows socket-placed calls in both parties' call history", async () => {
    const alice = await createUser("Alice", uniqueEmail("rt-hist-a"));
    const bob = await createUser("Bob", uniqueEmail("rt-hist-b"));

    const aliceSocket = await connectAs(alice);
    const bobSocket = await connectAs(bob);

    const bobIncoming = waitFor<{ call: CallPayload }>(bobSocket, "call:incoming");
    const startAck = await emitAck<{ call: CallPayload }>(aliceSocket, "call:start", {
      recipientId: bob.userId,
      type: "VIDEO",
    });
    await bobIncoming;
    const bobEnded = waitFor(bobSocket, "call:ended");
    await emitAck(aliceSocket, "call:end", { callId: startAck.call.id });
    await bobEnded;

    const app = await api();
    for (const user of [alice, bob]) {
      const history = await app.get("/api/v1/calls").set("Cookie", user.cookie);
      expect(history.status).toBe(200);
      const entry = history.body.data.find((c: { id: string }) => c.id === startAck.call.id);
      expect(entry).toBeTruthy();
      expect(entry.status).toBe("MISSED");
      expect(entry.type).toBe("VIDEO");
    }

    await Promise.all([closeSocket(aliceSocket), closeSocket(bobSocket)]);
  });
});
