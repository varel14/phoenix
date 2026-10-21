import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { PRICING_CURRENCY, SONG_DOWNLOAD_PRICE } from "../config/pricing.js";
import {
  downloadRepository,
  type DownloadWithMedia,
} from "../repositories/download.repository.js";
import { songRepository } from "../repositories/song.repository.js";
import { videoRepository } from "../repositories/video.repository.js";
import { subscriptionService } from "./subscription.service.js";
import { walletService } from "./wallet.service.js";
import { AppError } from "../lib/errors.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type { CreateDownloadBody } from "../validators/download.schema.js";

export const downloadService = {
  /**
   * SONG: pay-per-download — the first registration charges 1 FCFA from the
   * fan's wallet and credits the artist's (no page subscription required);
   * re-registration is free. VIDEO: unchanged — requires an active page
   * subscription and accrues the 1 FCFA/month royalty.
   */
  async register(
    userId: string,
    body: CreateDownloadBody,
  ): Promise<DownloadWithMedia> {
    if (body.mediaType === "SONG") {
      return this.registerSongDownload(userId, body.songId!);
    }

    const video = await videoRepository.findById(body.videoId!);
    if (!video) throw AppError.notFound("Video");
    if (!video.isDownloadable)
      throw AppError.forbidden("This video cannot be downloaded");
    await subscriptionService.requireActive(userId, video.artistId);
    const record = await downloadRepository.upsertVideoDownload(
      userId,
      body.videoId!,
    );
    if (!record) throw AppError.notFound("Download");
    await subscriptionService.accrueForNewDownload({
      downloadId: record.id,
      artistId: video.artistId,
      userId,
    });
    return record;
  },

  /**
   * Charges and records a song download atomically: the download row and the
   * wallet transfer commit together, so an unpaid download can never exist.
   * Artists downloading their own songs are not charged.
   */
  async registerSongDownload(
    userId: string,
    songId: string,
  ): Promise<DownloadWithMedia> {
    const song = await songRepository.findById(songId);
    if (!song) throw AppError.notFound("Song");
    if (!song.isDownloadable)
      throw AppError.forbidden("This song cannot be downloaded");

    const owned = await downloadRepository.findByUserAndSong(userId, songId);
    if (owned) return owned;

    const artistUserId = (
      await prisma.artist.findUnique({
        where: { id: song.artistId },
        select: { userId: true },
      })
    )?.userId;
    if (!artistUserId) throw AppError.notFound("Artist");

    try {
      await prisma.$transaction(async (tx) => {
        const record = await tx.download.create({
          data: {
            userId,
            songId,
            status: "COMPLETED",
            completedAt: new Date(),
            fileSizeBytes: song.fileSizeBytes,
          },
        });
        await songRepository.incrementDownloadCount(songId, tx);
        await walletService.settleDownloadCharge(tx, {
          buyerId: userId,
          artistUserId,
          amount: SONG_DOWNLOAD_PRICE,
          songId,
          downloadId: record.id,
          songTitle: song.title,
          currency: PRICING_CURRENCY,
        });
      });
    } catch (error) {
      // Lost a race against a parallel registration — the other transaction
      // already charged; treat the song as owned.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await downloadRepository.findByUserAndSong(
          userId,
          songId,
        );
        if (existing) return existing;
      }
      throw error;
    }

    const record = await downloadRepository.findByUserAndSong(userId, songId);
    if (!record)
      throw AppError.internal("Download record vanished after registration");
    return record;
  },

  async listMine(
    userId: string,
    options: {
      page: number;
      limit: number;
      mediaType?: "SONG" | "VIDEO" | undefined;
    },
  ): Promise<{ downloads: DownloadWithMedia[]; pagination: PaginationMeta }> {
    const [downloads, total] = await Promise.all([
      downloadRepository.findManyByUser(userId, options),
      downloadRepository.countByUser(userId, options.mediaType),
    ]);
    return {
      downloads,
      pagination: buildPagination(options.page, options.limit, total),
    };
  },

  async remove(userId: string, downloadId: string): Promise<void> {
    const record = await downloadRepository.findByIdRef(downloadId);
    if (!record || record.userId !== userId)
      throw AppError.notFound("Download");
    await downloadRepository.remove(downloadId);
  },
};
