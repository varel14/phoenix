import { prisma } from "../config/prisma.js";
import { AppError } from "../lib/errors.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type {
  CreateConversationBody,
  ListConversationsQuery,
  ListMessagesQuery,
  SendMessageBody,
} from "../validators/conversation.schema.js";
import {
  conversationRepository,
  messageRepository,
  type ConversationWithParticipants,
  type MessageWithRelations,
} from "../repositories/conversation.repository.js";

export type ConversationSummary = ConversationWithParticipants & {
  lastMessage: MessageWithRelations | null;
  unreadCount: number;
};

export const conversationService = {
  async list(
    userId: string,
    query: ListConversationsQuery,
  ): Promise<{
    conversations: ConversationSummary[];
    pagination: PaginationMeta;
  }> {
    const [conversations, total] = await Promise.all([
      conversationRepository.findManyByUser(userId, query),
      conversationRepository.countByUser(userId),
    ]);

    const conversationsWithMeta = await Promise.all(
      conversations.map(async (conversation) => {
        const participant = conversation.participants.find(
          (p) => p.userId === userId,
        );
        const [lastMessage, unreadCount] = await Promise.all([
          conversationRepository.lastMessage(conversation.id),
          conversationRepository.unreadCount(
            conversation.id,
            userId,
            participant?.lastReadAt ?? null,
          ),
        ]);
        return { ...conversation, lastMessage, unreadCount };
      }),
    );

    return {
      conversations: conversationsWithMeta,
      pagination: buildPagination(query.page, query.limit, total),
    };
  },

  /** Typo-tolerant user search (name or phone), excluding the requester. */
  async searchUsers(userId: string, search: string) {
    const users = await conversationRepository.searchUsers(userId, search);
    return users.map(({ phone, ...user }) => ({ ...user, phone }));
  },

  /**
   * WhatsApp-style contact matching: app users whose phone number ends with
   * the same digits as any device contact. Matching happens on the last 8
   * digits so international prefixes and spacing do not matter.
   */
  async matchContacts(userId: string, phones: string[]) {
    const digits = (value: string) => value.replace(/\D/g, "");
    const suffixes = [
      ...new Set(
        phones
          .map(digits)
          .filter((d) => d.length >= 6)
          .map((d) => d.slice(-8)),
      ),
    ];
    if (suffixes.length === 0) return [];
    const candidates = await prisma.user.findMany({
      where: { id: { not: userId }, phone: { not: null } },
      select: { id: true, name: true, image: true, phone: true },
    });
    return candidates
      .filter((user) => {
        const userDigits = digits(user.phone ?? "");
        return suffixes.some((suffix) => userDigits.endsWith(suffix));
      })
      .map(({ phone, ...user }) => ({ ...user, phone }));
  },

  /** Accepts a message request: the conversation becomes a normal thread. */
  async acceptRequest(userId: string, conversationId: string) {
    await this.getDetailOrThrow(userId, conversationId);
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });
    return { accepted: true };
  },

  /** Hides a conversation row (X button). A new incoming message re-shows it. */
  async hideConversation(userId: string, conversationId: string) {
    await this.getDetailOrThrow(userId, conversationId);
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { hiddenAt: new Date() },
    });
    return { hidden: true };
  },

  /** Typo-tolerant message search inside one conversation (pg_trgm). */
  async searchMessages(userId: string, conversationId: string, query: string) {
    await this.getDetailOrThrow(userId, conversationId);
    return conversationRepository.searchMessages(conversationId, query);
  },

  async createDirect(
    userId: string,
    body: CreateConversationBody,
  ): Promise<ConversationWithParticipants> {
    if (body.recipientId === userId) {
      throw AppError.badRequest(
        "You cannot start a conversation with yourself",
      );
    }
    const recipient = await prisma.user.findUnique({
      where: { id: body.recipientId },
      select: { id: true },
    });
    if (!recipient) throw AppError.notFound("User");

    const existing = await conversationRepository.findDirectConversation(
      userId,
      body.recipientId,
    );
    if (existing) {
      const conversation = await conversationRepository.findByIdForUser(
        existing.id,
        userId,
      );
      if (conversation) {
        // An attached first message is delivered even when the conversation
        // already exists (e.g. re-selecting a contact with a draft pending).
        if (body.message) {
          await this.sendMessage(userId, conversation.id, body.message);
          return (await conversationRepository.findByIdForUser(
            conversation.id,
            userId,
          )) as ConversationWithParticipants;
        }
        return conversation;
      }
    }
    return conversationRepository.createDirectConversation(
      userId,
      body.recipientId,
      {
        isDraft: body.draft ?? false,
        ...(body.message
          ? { firstMessage: { senderId: userId, data: body.message } }
          : {}),
      },
    );
  },

  /** Throws unless the user takes part in the conversation. */
  async getDetailOrThrow(
    userId: string,
    conversationId: string,
  ): Promise<ConversationWithParticipants> {
    const conversation = await conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );
    if (!conversation)
      throw AppError.forbidden(
        "You are not a participant of this conversation",
      );
    return conversation;
  },

  async listMessages(
    userId: string,
    conversationId: string,
    query: ListMessagesQuery,
  ): Promise<{ messages: MessageWithRelations[]; pagination: PaginationMeta }> {
    await this.getDetailOrThrow(userId, conversationId);
    const [messages, total] = await Promise.all([
      messageRepository.findMany(conversationId, query),
      messageRepository.count(conversationId),
    ]);
    return {
      messages,
      pagination: buildPagination(query.page, query.limit, total),
    };
  },

  async sendMessage(
    userId: string,
    conversationId: string,
    body: SendMessageBody,
  ): Promise<{ message: MessageWithRelations; otherParticipantIds: string[] }> {
    const conversation = await this.getDetailOrThrow(userId, conversationId);
    const message = await messageRepository.create(
      conversationId,
      userId,
      body,
    );
    if (conversation.isDraft) {
      // First real message promotes the draft ("brouillon") conversation.
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { isDraft: false },
      });
    }
    // Sending engages the sender (accepts a pending request) and re-shows
    // the thread for anyone who dismissed it — WhatsApp behavior.
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: {
        acceptedAt:
          conversation.participants.find((p) => p.userId === userId)
            ?.acceptedAt ?? new Date(),
        hiddenAt: null,
      },
    });
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: { not: userId },
        hiddenAt: { not: null },
      },
      data: { hiddenAt: null },
    });
    const otherParticipantIds = conversation.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);
    return { message, otherParticipantIds };
  },

  async markRead(
    userId: string,
    conversationId: string,
  ): Promise<{ lastReadAt: Date }> {
    await this.getDetailOrThrow(userId, conversationId);
    const lastReadAt = await conversationRepository.markRead(
      conversationId,
      userId,
    );
    return { lastReadAt };
  },

  async unreadTotal(userId: string): Promise<number> {
    const memberships = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true },
    });
    const counts = await Promise.all(
      memberships.map((m) =>
        conversationRepository.unreadCount(
          m.conversationId,
          userId,
          m.lastReadAt,
        ),
      ),
    );
    return counts.reduce((sum, count) => sum + count, 0);
  },
};
