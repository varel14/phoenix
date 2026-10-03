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
  ): Promise<{ conversations: ConversationSummary[]; pagination: PaginationMeta }> {
    const [conversations, total] = await Promise.all([
      conversationRepository.findManyByUser(userId, query),
      conversationRepository.countByUser(userId),
    ]);

    const conversationsWithMeta = await Promise.all(
      conversations.map(async (conversation) => {
        const participant = conversation.participants.find((p) => p.userId === userId);
        const [lastMessage, unreadCount] = await Promise.all([
          conversationRepository.lastMessage(conversation.id),
          conversationRepository.unreadCount(conversation.id, userId, participant?.lastReadAt ?? null),
        ]);
        return { ...conversation, lastMessage, unreadCount };
      }),
    );

    return { conversations: conversationsWithMeta, pagination: buildPagination(query.page, query.limit, total) };
  },

  /** Users matching a name search, excluding the requester (picker data only). */
  async searchUsers(userId: string, search: string) {
    return prisma.user.findMany({
      where: {
        id: { not: userId },
        name: { contains: search, mode: "insensitive" },
      },
      select: { id: true, name: true, image: true },
      take: 20,
      orderBy: { name: "asc" },
    });
  },

  async createDirect(userId: string, body: CreateConversationBody): Promise<ConversationWithParticipants> {    if (body.recipientId === userId) {
      throw AppError.badRequest("You cannot start a conversation with yourself");
    }
    const recipient = await prisma.user.findUnique({ where: { id: body.recipientId }, select: { id: true } });
    if (!recipient) throw AppError.notFound("User");

    const existing = await conversationRepository.findDirectConversation(userId, body.recipientId);
    if (existing) {
      const conversation = await conversationRepository.findByIdForUser(existing.id, userId);
      if (conversation) return conversation;
    }
    return conversationRepository.createDirectConversation(userId, body.recipientId);
  },

  /** Throws unless the user takes part in the conversation. */
  async getDetailOrThrow(userId: string, conversationId: string): Promise<ConversationWithParticipants> {
    const conversation = await conversationRepository.findByIdForUser(conversationId, userId);
    if (!conversation) throw AppError.forbidden("You are not a participant of this conversation");
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
    return { messages, pagination: buildPagination(query.page, query.limit, total) };
  },

  async sendMessage(
    userId: string,
    conversationId: string,
    body: SendMessageBody,
  ): Promise<{ message: MessageWithRelations; otherParticipantIds: string[] }> {
    const conversation = await this.getDetailOrThrow(userId, conversationId);
    const message = await messageRepository.create(conversationId, userId, body);
    const otherParticipantIds = conversation.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);
    return { message, otherParticipantIds };
  },

  async markRead(userId: string, conversationId: string): Promise<{ lastReadAt: Date }> {
    await this.getDetailOrThrow(userId, conversationId);
    const lastReadAt = await conversationRepository.markRead(conversationId, userId);
    return { lastReadAt };
  },

  async unreadTotal(userId: string): Promise<number> {
    const memberships = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true },
    });
    const counts = await Promise.all(
      memberships.map((m) => conversationRepository.unreadCount(m.conversationId, userId, m.lastReadAt)),
    );
    return counts.reduce((sum, count) => sum + count, 0);
  },
};
