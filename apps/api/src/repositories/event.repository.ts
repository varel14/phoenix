import { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

export interface IngestEventInput {
  clientEventId: string;
  userId: string;
  eventType: "PLAY" | "VIEW" | "DOWNLOAD";
  songId?: string | undefined;
  videoId?: string | undefined;
  occurredAt: Date;
}

export const eventRepository = {
  /**
   * Creates the event and bumps the denormalized counters in one transaction.
   * Returns false when the event already exists (duplicate clientEventId).
   */
  async ingestWithCounters(input: IngestEventInput): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.playbackEvent.create({
          data: {
            clientEventId: input.clientEventId,
            userId: input.userId,
            eventType: input.eventType,
            songId: input.songId ?? null,
            videoId: input.videoId ?? null,
            occurredAt: input.occurredAt,
          },
        });

        if (input.eventType === "PLAY" && input.songId) {
          await tx.song.update({
            where: { id: input.songId },
            data: { playCount: { increment: 1 } },
          });
        }
        if (input.eventType === "VIEW" && input.videoId) {
          await tx.video.update({
            where: { id: input.videoId },
            data: { viewCount: { increment: 1 } },
          });
        }
        if (input.eventType === "DOWNLOAD") {
          if (input.songId) {
            await tx.song.update({
              where: { id: input.songId },
              data: { downloadCount: { increment: 1 } },
            });
          }
          if (input.videoId) {
            await tx.video.update({
              where: { id: input.videoId },
              data: { downloadCount: { increment: 1 } },
            });
          }
        }
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return false; // duplicate clientEventId — already processed
      }
      throw error;
    }
  },

  async findByClientEventId(clientEventId: string) {
    return prisma.playbackEvent.findUnique({
      where: { clientEventId },
      select: { id: true, clientEventId: true },
    });
  },
};
