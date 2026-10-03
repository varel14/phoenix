import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

export const callPartySelect = { id: true, name: true, image: true } as const;

export const callInclude = {
  caller: { select: callPartySelect },
  recipient: { select: callPartySelect },
} as const;

export type CallWithParties = Prisma.CallGetPayload<{ include: typeof callInclude }>;

export const callRepository = {
  async findById(id: string): Promise<CallWithParties | null> {
    return prisma.call.findUnique({ where: { id }, include: callInclude });
  },

  async findManyByUser(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<CallWithParties[]> {
    return prisma.call.findMany({
      where: { OR: [{ callerId: userId }, { recipientId: userId }] },
      include: callInclude,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async countByUser(userId: string): Promise<number> {
    return prisma.call.count({ where: { OR: [{ callerId: userId }, { recipientId: userId }] } });
  },
};
