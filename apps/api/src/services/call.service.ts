import { prisma } from "../config/prisma.js";
import { AppError } from "../lib/errors.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import { conversationRepository } from "../repositories/conversation.repository.js";
import { callRepository, callInclude, type CallWithParties } from "../repositories/call.repository.js";
export type { CallWithParties };
import type { ListCallsQuery } from "../validators/call.schema.js";

const TERMINAL_STATUSES = new Set(["REJECTED", "MISSED", "ENDED", "FAILED"]);

export const callService = {
  async start(
    callerId: string,
    payload: { recipientId: string; type: "AUDIO" | "VIDEO"; conversationId?: string | undefined },
  ): Promise<CallWithParties> {
    if (payload.recipientId === callerId) throw AppError.badRequest("You cannot call yourself");
    const recipient = await prisma.user.findUnique({ where: { id: payload.recipientId }, select: { id: true } });
    if (!recipient) throw AppError.notFound("User");

    if (payload.conversationId) {
      const conversation = await conversationRepository.findByIdForUser(payload.conversationId, callerId);
      if (!conversation) throw AppError.forbidden("You are not a participant of this conversation");
    }

    return prisma.call.create({
      data: {
        callerId,
        recipientId: payload.recipientId,
        type: payload.type,
        conversationId: payload.conversationId ?? null,
      },
      include: callInclude,
    });
  },

  async getForUser(userId: string, callId: string): Promise<CallWithParties> {
    const call = await callRepository.findById(callId);
    if (!call || (call.callerId !== userId && call.recipientId !== userId)) {
      throw AppError.notFound("Call");
    }
    return call;
  },

  async accept(userId: string, callId: string): Promise<CallWithParties> {
    const call = await callRepository.findById(callId);
    if (!call || call.recipientId !== userId) throw AppError.notFound("Call");
    if (call.status !== "RINGING") throw AppError.conflict("This call is no longer ringing");
    return prisma.call.update({
      where: { id: callId },
      data: { status: "ACCEPTED", answeredAt: new Date() },
      include: callInclude,
    });
  },

  async reject(userId: string, callId: string): Promise<CallWithParties> {
    const call = await callRepository.findById(callId);
    if (!call || call.recipientId !== userId) throw AppError.notFound("Call");
    if (TERMINAL_STATUSES.has(call.status)) throw AppError.conflict("This call is already over");
    return prisma.call.update({
      where: { id: callId },
      data: { status: "REJECTED", endedAt: new Date(), durationSec: 0 },
      include: callInclude,
    });
  },

  async end(userId: string, callId: string): Promise<CallWithParties> {
    const call = await this.getForUser(userId, callId);
    if (TERMINAL_STATUSES.has(call.status)) return call;

    const now = new Date();
    if (call.status === "RINGING") {
      // Nobody answered in time / caller hung up while ringing.
      return prisma.call.update({
        where: { id: callId },
        data: { status: "MISSED", endedAt: now, durationSec: 0 },
        include: callInclude,
      });
    }
    const durationSec = Math.max(0, Math.round((now.getTime() - (call.answeredAt ?? call.startedAt).getTime()) / 1000));
    return prisma.call.update({
      where: { id: callId },
      data: { status: "ENDED", endedAt: now, durationSec },
      include: callInclude,
    });
  },

  /**
   * Server-side ring timeout: nobody answered before the deadline.
   * Returns null when the call was already answered or is over.
   */
  async expireIfStillRinging(callId: string): Promise<CallWithParties | null> {
    const call = await callRepository.findById(callId);
    if (!call || call.status !== "RINGING") return null;
    const now = new Date();
    return prisma.call.update({
      where: { id: callId },
      data: { status: "MISSED", endedAt: now, durationSec: 0 },
      include: callInclude,
    });
  },

  async list(
    userId: string,
    query: ListCallsQuery,
  ): Promise<{ calls: CallWithParties[]; pagination: PaginationMeta }> {
    const [calls, total] = await Promise.all([
      callRepository.findManyByUser(userId, query),
      callRepository.countByUser(userId),
    ]);
    return { calls, pagination: buildPagination(query.page, query.limit, total) };
  },
};
