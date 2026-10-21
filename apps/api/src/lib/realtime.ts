import type { Server as HttpServer } from "node:http";
import { fromNodeHeaders } from "better-auth/node";
import { Server as IOServer, type Socket } from "socket.io";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { auth } from "./auth.js";
import { conversationRepository } from "../repositories/conversation.repository.js";
import { conversationService } from "../services/conversation.service.js";
import { callService } from "../services/call.service.js";
import { pushService } from "./push.js";
import { sendMessageBodySchema } from "../validators/conversation.schema.js";
import type { MessageWithRelations } from "../repositories/conversation.repository.js";
import type { CallWithParties } from "../services/call.service.js";

export type SocketUser = { id: string; name: string; image: string | null };

declare module "socket.io" {
  interface SocketData {
    user: SocketUser;
  }
}

let io: IOServer | null = null;

/** A user with at least one connected socket is considered online. */
async function isUserConnected(userId: string): Promise<boolean> {
  if (!io) return false;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  return sockets.length > 0;
}

async function resolveSocketUser(socket: Socket): Promise<SocketUser | null> {
  const authPayload = (socket.handshake.auth ?? {}) as { sessionToken?: string };
  const sessionToken = authPayload.sessionToken;
  if (sessionToken) {
    // Some Better Auth setups store "<token>.<signature>" in the cookie; try every part.
    const candidates = sessionToken.includes(".") ? [sessionToken, ...sessionToken.split(".")] : [sessionToken];
    for (const candidate of candidates) {
      const session = await prisma.session.findUnique({
        where: { token: candidate },
        select: { expiresAt: true, user: { select: { id: true, name: true, image: true } } },
      });
      if (session && session.expiresAt > new Date()) return session.user;
    }
  }
  // Web clients can authenticate through the session cookie directly.
  if (socket.handshake.headers.cookie) {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(socket.handshake.headers) });
      if (session) return { id: session.user.id, name: session.user.name, image: session.user.image ?? null };
    } catch {
      return null;
    }
  }
  return null;
}

type AckResponse = { error?: string; message?: MessageWithRelations; call?: CallWithParties };

/**
 * A call that nobody answers must not ring forever: after the deadline the
 * server marks it MISSED and tells both parties, so a dead callee device
 * cannot leave the caller's UI hanging.
 */
const ringTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRingTimeout(callId: string, ringTimeoutMs: number): void {
  const timer = setTimeout(() => {
    ringTimers.delete(callId);
    void callService
      .expireIfStillRinging(callId)
      .then((call) => {
        if (!call) return;
        io?.to(`user:${call.callerId}`).emit("call:ended", { call });
        io?.to(`user:${call.recipientId}`).emit("call:ended", { call });
        // The recipient was not reachable in time — most likely offline.
        void pushService.sendToUsers([call.recipientId], {
          title: "Appel manqué",
          body: `Appel ${call.type === "VIDEO" ? "vidéo" : "audio"} de ${call.caller.name}`,
          data: { kind: "call", callId: call.id, status: "MISSED" },
          channelId: "calls",
        });
      })
      .catch(() => {
        // Best-effort: the caller can still hang up manually.
      });
  }, ringTimeoutMs);
  timer.unref();
  ringTimers.set(callId, timer);
}

function clearRingTimeout(callId: string): void {
  const timer = ringTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    ringTimers.delete(callId);
  }
}

export function initRealtime(
  server: HttpServer,
  options: { ringTimeoutMs?: number } = {},
): IOServer {
  const ringTimeoutMs = options.ringTimeoutMs ?? env.RING_TIMEOUT_MS;
  io = new IOServer(server, {
    cors: {
      origin: env.corsOrigins.includes("*") ? true : env.corsOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const user = await resolveSocketUser(socket);
      if (!user) {
        next(new Error("UNAUTHORIZED"));
        return;
      }
      socket.data.user = user;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);

    // ------------------------------------------------------------------ chat
    socket.on("conversation:join", async (payload: { conversationId?: string }, ack?: (res: AckResponse) => void) => {
      try {
        if (!payload?.conversationId) throw new Error("conversationId is required");
        const conversation = await conversationRepository.findByIdForUser(payload.conversationId, user.id);
        if (!conversation) throw new Error("You are not a participant of this conversation");
        socket.join(`conversation:${payload.conversationId}`);
        ack?.({});
      } catch (error) {
        ack?.({ error: (error as Error).message });
      }
    });

    socket.on("conversation:leave", (payload: { conversationId?: string }) => {
      if (payload?.conversationId) socket.leave(`conversation:${payload.conversationId}`);
    });

    socket.on(
      "conversation:message",
      async (
        payload: {
          conversationId?: string;
          type?: "TEXT" | "VOICE" | "IMAGE" | "VIDEO" | "FILE";
          content?: string;
          attachment?: unknown;
        },
        ack?: (res: AckResponse) => void,
      ) => {
        try {
          if (!payload?.conversationId) throw new Error("conversationId is required");
          const parsed = sendMessageBodySchema.safeParse({
            type: payload.type ?? "TEXT",
            content: payload.content,
            attachment: payload.attachment,
          });
          if (!parsed.success) throw new Error("Invalid message payload");
          const { message, otherParticipantIds } = await conversationService.sendMessage(
            user.id,
            payload.conversationId,
            parsed.data,
          );
          socket.to(`conversation:${payload.conversationId}`).emit("message:new", {
            conversationId: payload.conversationId,
            message,
          });
          for (const participantId of otherParticipantIds) {
            io?.to(`user:${participantId}`).emit("message:received", {
              conversationId: payload.conversationId,
              message,
            });
          }
          // Devices that are offline right now learn about the message through push.
          const offlineParticipantIds: string[] = [];
          for (const participantId of otherParticipantIds) {
            if (!(await isUserConnected(participantId))) offlineParticipantIds.push(participantId);
          }
          if (offlineParticipantIds.length > 0) {
            const preview =
              message.type === "VOICE"
                ? "Message vocal"
                : message.type === "IMAGE"
                  ? (message.content ? `Photo · ${message.content}` : "Photo")
                  : message.type === "VIDEO"
                    ? (message.content ? `Vidéo · ${message.content}` : "Vidéo")
                    : message.type === "FILE"
                      ? (message.attachment?.name ?? "Fichier")
                      : (message.content ?? "").slice(0, 120) || "Nouveau message";
            void pushService.sendToUsers(offlineParticipantIds, {
              title: user.name,
              body: preview,
              data: { kind: "message", conversationId: payload.conversationId, messageId: message.id },
              channelId: "messages",
            });
          }
          ack?.({ message });
        } catch (error) {
          ack?.({ error: (error as Error).message });
        }
      },
    );

    socket.on("conversation:read", async (payload: { conversationId?: string }) => {
      try {
        if (!payload?.conversationId) return;
        const result = await conversationService.markRead(user.id, payload.conversationId);
        io?.to(`conversation:${payload.conversationId}`).emit("message:read", {
          conversationId: payload.conversationId,
          userId: user.id,
          lastReadAt: result.lastReadAt,
        });
      } catch {
        // Read receipts are best-effort.
      }
    });

    // ----------------------------------------------------------------- calls
    socket.on(
      "call:start",
      async (
        payload: { recipientId?: string; type?: "AUDIO" | "VIDEO"; conversationId?: string },
        ack?: (res: AckResponse) => void,
      ) => {
        try {
          if (!payload?.recipientId) throw new Error("recipientId is required");
          const call = await callService.start(user.id, {
            recipientId: payload.recipientId,
            type: payload.type === "VIDEO" ? "VIDEO" : "AUDIO",
            conversationId: payload.conversationId,
          });
          scheduleRingTimeout(call.id, ringTimeoutMs);
          io?.to(`user:${payload.recipientId}`).emit("call:incoming", { call });
          // Offline recipient: the socket event goes nowhere, so ring them with a push instead.
          if (!(await isUserConnected(payload.recipientId))) {
            void pushService.sendToUsers([payload.recipientId], {
              title: user.name,
              body: `Appel ${call.type === "VIDEO" ? "vidéo" : "audio"} entrant…`,
              data: { kind: "call", callId: call.id, callType: call.type },
              channelId: "calls",
            });
          }
          ack?.({ call });
        } catch (error) {
          ack?.({ error: (error as Error).message });
        }
      },
    );

    socket.on("call:accept", async (payload: { callId?: string }, ack?: (res: AckResponse) => void) => {
      try {
        if (!payload?.callId) throw new Error("callId is required");
        clearRingTimeout(payload.callId);
        const call = await callService.accept(user.id, payload.callId);
        io?.to(`user:${call.callerId}`).emit("call:accepted", { call });
        io?.to(`user:${call.recipientId}`).emit("call:accepted", { call });
        ack?.({ call });
      } catch (error) {
        ack?.({ error: (error as Error).message });
      }
    });

    socket.on("call:reject", async (payload: { callId?: string }, ack?: (res: AckResponse) => void) => {
      try {
        if (!payload?.callId) throw new Error("callId is required");
        clearRingTimeout(payload.callId);
        const call = await callService.reject(user.id, payload.callId);
        io?.to(`user:${call.callerId}`).emit("call:rejected", { call });
        ack?.({ call });
      } catch (error) {
        ack?.({ error: (error as Error).message });
      }
    });

    socket.on("call:end", async (payload: { callId?: string }, ack?: (res: AckResponse) => void) => {
      try {
        if (!payload?.callId) throw new Error("callId is required");
        clearRingTimeout(payload.callId);
        const call = await callService.end(user.id, payload.callId);
        io?.to(`user:${call.callerId}`).emit("call:ended", { call });
        io?.to(`user:${call.recipientId}`).emit("call:ended", { call });
        ack?.({ call });
      } catch (error) {
        ack?.({ error: (error as Error).message });
      }
    });

    // WebRTC signaling relay: only the two participants of a call may exchange signals.
    const relayWebRtc = (event: "webrtc:offer" | "webrtc:answer" | "webrtc:ice-candidate") => {
      return async (
        payload: { callId?: string; sdp?: string; candidate?: unknown },
        ack?: (res: AckResponse) => void,
      ) => {
        try {
          if (!payload?.callId) throw new Error("callId is required");
          const call = await callService.getForUser(user.id, payload.callId);
          const peerId = call.callerId === user.id ? call.recipientId : call.callerId;
          io?.to(`user:${peerId}`).emit(event, {
            callId: call.id,
            fromUserId: user.id,
            sdp: payload.sdp,
            candidate: payload.candidate,
          });
          ack?.({});
        } catch (error) {
          ack?.({ error: (error as Error).message });
        }
      };
    };

    socket.on("webrtc:offer", relayWebRtc("webrtc:offer"));
    socket.on("webrtc:answer", relayWebRtc("webrtc:answer"));
    socket.on("webrtc:ice-candidate", relayWebRtc("webrtc:ice-candidate"));

    socket.on("disconnect", () => {
      // Presence tracking is intentionally minimal for the MVP.
    });
  });

  return io;
}

export function getIo(): IOServer | null {
  return io;
}

/** No-ops when realtime has not been initialized (e.g. in unit tests). */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** No-ops when realtime has not been initialized (e.g. in unit tests). */
export function emitToConversation(conversationId: string, event: string, payload: unknown): void {
  io?.to(`conversation:${conversationId}`).emit(event, payload);
}
