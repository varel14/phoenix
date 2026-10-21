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

export type MessageWithRelations = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

export const conversationRepository = {
  async findManyByUser(
    userId: string,
    options: { page: number; limit: number; search?: string | undefined },
  ): Promise<ConversationWithParticipants[]> {
    const where: Prisma.ConversationWhereInput = {
      participants: { some: { userId } },
    };
    if (options.search) {
      where.type = "DIRECT";
      where.participants = {
        some: {
          userId: { not: userId },
          user: { name: { contains: options.search, mode: "insensitive" } },
        },
      };
    }
    return prisma.conversation.findMany({
      where,
      include: conversationParticipantInclude,
      orderBy: { updatedAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async countByUser(userId: string): Promise<number> {
    return prisma.conversation.count({ where: { participants: { some: { userId } } } });
  },

  /** Returns the conversation when the user takes part in it. */
  async findByIdForUser(conversationId: string, userId: string): Promise<ConversationWithParticipants | null> {
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

  async createDirectConversation(userAId: string, userBId: string) {
    return prisma.conversation.create({
      data: {
        type: "DIRECT",
        participants: {
          create: [{ userId: userAId }, { userId: userBId }],
        },
      },
      include: conversationParticipantInclude,
    });
  },

  async touch(conversationId: string): Promise<void> {
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  },

  async lastMessage(conversationId: string): Promise<MessageWithRelations | null> {
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

  async unreadCount(conversationId: string, userId: string, lastReadAt: Date | null): Promise<number> {
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
