import { videoRepository } from "../repositories/video.repository.js";
import { AppError } from "../lib/errors.js";
import { pruneUndefined } from "../lib/prune.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type { VideoWithArtist } from "../types/media.js";
import type { CreateVideoBody, ListVideosQuery, SearchVideosQuery, UpdateVideoBody } from "../validators/video.schema.js";

export const videoService = {
  async list(query: ListVideosQuery): Promise<{ videos: VideoWithArtist[]; pagination: PaginationMeta }> {
    const [videos, total] = await Promise.all([
      videoRepository.findMany(query),
      videoRepository.count(query),
    ]);
    return { videos, pagination: buildPagination(query.page, query.limit, total) };
  },

  async search(query: SearchVideosQuery): Promise<{ videos: VideoWithArtist[]; pagination: PaginationMeta }> {
    const [videos, total] = await Promise.all([
      videoRepository.search(query),
      videoRepository.countSearch(query.q),
    ]);
    return { videos, pagination: buildPagination(query.page, query.limit, total) };
  },

  async getById(id: string): Promise<VideoWithArtist> {
    const video = await videoRepository.findById(id);
    if (!video) throw AppError.notFound("Video");
    return video;
  },

  async create(artistId: string, body: CreateVideoBody): Promise<VideoWithArtist> {
    return videoRepository.create(artistId, pruneUndefined(body));
  },

  async update(videoId: string, artistId: string, body: UpdateVideoBody): Promise<VideoWithArtist> {
    const video = await videoRepository.findByIdRef(videoId);
    if (!video || video.artistId !== artistId) throw AppError.notFound("Video");
    return videoRepository.update(videoId, pruneUndefined(body));
  },

  async remove(videoId: string, artistId: string): Promise<void> {
    const video = await videoRepository.findByIdRef(videoId);
    if (!video || video.artistId !== artistId) throw AppError.notFound("Video");
    await videoRepository.remove(videoId);
  },
};
