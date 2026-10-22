import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { MessageAttachmentInput } from "../validators/conversation.schema.js";

export const conversationParticipantInclude = {
  participants: {
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  },
} as const;

export const messageInclude = {
  sender: { select: { id: true, name: true, image: true } },
  attachment: true,
} as const;

export type ConversationWithParticipants = Prisma.ConversationGetPayload<{
  include: typeof conversationParticipantInclude;
}>;

export type MessageWithRelations = Prisma.MessageGetPayload<{
  include: typeof messageInclude;
}>;

export const conversationRepository = {
  /**
   * Typo-tolerant search: participant names and message contents are matched
   * with pg_trgm word similarity, so "salut" finds "salut !"
   * and "bonjor" still finds "bonjour". Best match ranks first.
   */
  async findManyByUser(
    userId: string,
    options: { page: number; limit: number; search?: string | undefined },
  ): Promise<ConversationWithParticipants[]> {
    const baseWhere: Prisma.ConversationWhereInput = {
      participants: { some: { userId } },
    };
    const term = options.search?.trim() ?? "";
    if (term.length < 3) {
      // Sub-trigram queries cannot use similarity; prefix-match on names.
      const where: Prisma.ConversationWhereInput = {
        ...baseWhere,
        ...(term.length > 0
          ? {
              participants: {
                some: {
                  userId: { not: userId },
                  user: { name: { startsWith: term, mode: "insensitive" } },
                },
              },
            }
          : {}),
      };
      return prisma.conversation.findMany({
        where,
        include: conversationParticipantInclude,
        orderBy: { updatedAt: "desc" },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      });
    }

    const matched = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT c.id,
             GREATEST(
               COALESCE(MAX(similarity(u.name, ${term})), 0),
               COALESCE(MAX(similarity(m.content, ${term})), 0)
             ) AS score
      FROM conversations c
      JOIN conversation_participants cp_me
        ON cp_me.conversation_id = c.id AND cp_me.user_id = ${userId}
      LEFT JOIN conversation_participants cp
        ON cp.conversation_id = c.id AND cp.user_id <> ${userId}
      LEFT JOIN users u ON u.id = cp.user_id
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE word_similarity(${term}, u.name) >= 0.4
         OR word_similarity(${term}, m.content) >= 0.3
      GROUP BY c.id
      ORDER BY score DESC, c.updated_at DESC
      LIMIT ${options.limit} OFFSET ${(options.page - 1) * options.limit}
    `;
    if (matched.length === 0) return [];
    const ids = matched.map((row) => row.id);
    const conversations = await prisma.conversation.findMany({
      where: { id: { in: ids }, ...baseWhere },
      include: conversationParticipantInclude,
    });
    // Restore the trigram ranking that findMany loses.
    return ids
      .map((id) => conversations.find((conversation) => conversation.id === id))
      .filter((conversation): conversation is ConversationWithParticipants =>
        Boolean(conversation),
      );
  },

  async countByUser(userId: string): Promise<number> {
    return prisma.conversation.count({
      where: { participants: { some: { userId } } },
    });
  },

  /**
   * Typo-tolerant message search inside one conversation, best match first.
   * Short queries (under 3 chars) fall back to substring matching.
   */
  async searchMessages(
    conversationId: string,
    query: string,
    limit = 50,
  ): Promise<MessageWithRelations[]> {
    const term = query.trim();
    if (term.length === 0) return [];
    if (term.length < 3) {
      return prisma.message.findMany({
        where: {
          conversationId,
          content: { contains: term, mode: "insensitive" },
        },
        include: messageInclude,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM messages
      WHERE conversation_id = ${conversationId}
        AND content IS NOT NULL
        AND word_similarity(${term}, content) >= 0.3
      ORDER BY word_similarity(${term}, content) DESC, created_at DESC
      LIMIT ${limit}
    `;
    if (rows.length === 0) return [];
    const messages = await prisma.message.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: messageInclude,
    });
    return rows
      .map((row) => messages.find((message) => message.id === row.id))
      .filter((message): message is MessageWithRelations => Boolean(message));
  },

  /**
   * Typo-tolerant user search for the new-conversation picker. Short queries
   * fall back to prefix matching.
   */
  async searchUsers(
    userId: string,
    search: string,
    limit = 20,
  ): Promise<Array<{ id: string; name: string; image: string | null }>> {
    const term = search.trim();
    if (term.length < 3) {
      // Empty search returns the default contact list (newest members).
      return prisma.user.findMany({
        where: {
          id: { not: userId },
          ...(term.length > 0
            ? { name: { startsWith: term, mode: "insensitive" } }
            : {}),
        },
        select: { id: true, name: true, image: true },
        take: limit,
        orderBy: { createdAt: "desc" },
      });
    }
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users
      WHERE id <> ${userId} AND word_similarity(${term}, name) >= 0.4
      ORDER BY word_similarity(${term}, name) DESC, name ASC
      LIMIT ${limit}
    `;
    if (rows.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: { id: true, name: true, image: true },
    });
    return rows
      .map((row) => users.find((user) => user.id === row.id))
      .filter(
        (user): user is { id: string; name: string; image: string | null } =>
          Boolean(user),
      );
  },

  /** Returns the conversation when the user takes part in it. */
  async findByIdForUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationWithParticipants | null> {
    return prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId } } },
      include: conversationParticipantInclude,
    });
  },

  async findDirectConversation(userAId: string, userBId: string) {
    return prisma.conversation.findFirst({
      where: {
        type: "DIRECT",
        participants: {
          every: { userId: { in: [userAId, userBId] } },
          some: { userId: userBId },
        },
      },
      select: { id: true },
    });
  },

  async createDirectConversation(
    userAId: string,
    userBId: string,
    options?: {
      isDraft?: boolean;
      firstMessage?: {
        senderId: string;
        data: {
          type: "TEXT" | "VOICE" | "IMAGE" | "VIDEO" | "FILE";
          content?: string | undefined;
          attachment?: MessageAttachmentInput | undefined;
        };
      };
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          type: "DIRECT",
          isDraft: options?.isDraft ?? false,
          participants: {
            create: [{ userId: userAId }, { userId: userBId }],
          },
        },
        include: conversationParticipantInclude,
      });
      if (options?.firstMessage) {
        const data = options.firstMessage.data;
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: options.firstMessage.senderId,
            type: data.type,
            content: data.content ?? null,
            ...(data.attachment
              ? {
                  attachment: {
                    create: {
                      url: data.attachment.url,
                      storageKey: data.attachment.storageKey,
                      mimeType: data.attachment.mimeType ?? null,
                      fileSizeBytes: data.attachment.fileSizeBytes ?? null,
                      durationSec: data.attachment.durationSec ?? null,
                      name: data.attachment.name ?? null,
                    },
                  },
                }
              : {}),
          },
          include: messageInclude,
        });
      }
      return conversation;
    });
  },

  async touch(conversationId: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  },

  async lastMessage(
    conversationId: string,
  ): Promise<MessageWithRelations | null> {
    return prisma.message.findFirst({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  async findParticipant(conversationId: string, userId: string) {
    return prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
  },

  async unreadCount(
    conversationId: string,
    userId: string,
    lastReadAt: Date | null,
  ): Promise<number> {
    return prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
  },

  async markRead(conversationId: string, userId: string): Promise<Date> {
    const readAt = new Date();
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: readAt },
    });
    return readAt;
  },
};

export const messageRepository = {
  async findMany(
    conversationId: string,
    options: { page: number; limit: number },
  ): Promise<MessageWithRelations[]> {
    return prisma.message.findMany({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async count(conversationId: string): Promise<number> {
    return prisma.message.count({ where: { conversationId } });
  },

  async create(
    conversationId: string,
    senderId: string,
    data: {
      type: "TEXT" | "VOICE" | "IMAGE" | "VIDEO" | "FILE";
      content?: string | undefined;
      attachment?: MessageAttachmentInput | undefined;
    },
  ): Promise<MessageWithRelations> {
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: data.type,
        content: data.content ?? null,
        ...(data.attachment
          ? {
              attachment: {
                create: {
                  url: data.attachment.url,
                  storageKey: data.attachment.storageKey,
                  mimeType: data.attachment.mimeType ?? null,
                  fileSizeBytes: data.attachment.fileSizeBytes ?? null,
                  durationSec: data.attachment.durationSec ?? null,
                  name: data.attachment.name ?? null,
                },
              },
            }
          : {}),
      },
      include: messageInclude,
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  },
};
