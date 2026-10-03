import { downloadRepository, type DownloadWithMedia } from "../repositories/download.repository.js";
import { songRepository } from "../repositories/song.repository.js";
import { videoRepository } from "../repositories/video.repository.js";
import { subscriptionService } from "./subscription.service.js";
import { AppError } from "../lib/errors.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type { CreateDownloadBody } from "../validators/download.schema.js";

export const downloadService = {
  /**
   * Idempotent: re-registering an already completed download returns the record.
   * Requires an active subscription to the artist's page; each kept download
   * accrues its 1 FCFA/month royalty to the artist.
   */
  async register(userId: string, body: CreateDownloadBody): Promise<DownloadWithMedia> {
    if (body.mediaType === "SONG") {
      const song = await songRepository.findById(body.songId!);
      if (!song) throw AppError.notFound("Song");
      if (!song.isDownloadable) throw AppError.forbidden("This song cannot be downloaded");
      await subscriptionService.requireActive(userId, song.artistId);
      const record = await downloadRepository.upsertSongDownload(userId, body.songId!);
      if (!record) throw AppError.notFound("Download");
      await subscriptionService.accrueForNewDownload({
        downloadId: record.id,
        artistId: song.artistId,
        userId,
      });
      return record;
    }

    const video = await videoRepository.findById(body.videoId!);
    if (!video) throw AppError.notFound("Video");
    if (!video.isDownloadable) throw AppError.forbidden("This video cannot be downloaded");
    await subscriptionService.requireActive(userId, video.artistId);
    const record = await downloadRepository.upsertVideoDownload(userId, body.videoId!);
    if (!record) throw AppError.notFound("Download");
    await subscriptionService.accrueForNewDownload({
      downloadId: record.id,
      artistId: video.artistId,
      userId,
    });
    return record;
  },

  async listMine(
    userId: string,
    options: { page: number; limit: number; mediaType?: "SONG" | "VIDEO" | undefined },
  ): Promise<{ downloads: DownloadWithMedia[]; pagination: PaginationMeta }> {
    const [downloads, total] = await Promise.all([
      downloadRepository.findManyByUser(userId, options),
      downloadRepository.countByUser(userId, options.mediaType),
    ]);
    return { downloads, pagination: buildPagination(options.page, options.limit, total) };
  },

  async remove(userId: string, downloadId: string): Promise<void> {
    const record = await downloadRepository.findByIdRef(downloadId);
    if (!record || record.userId !== userId) throw AppError.notFound("Download");
    await downloadRepository.remove(downloadId);
  },
};
