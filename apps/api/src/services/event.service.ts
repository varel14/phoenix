import { eventRepository, type IngestEventInput } from "../repositories/event.repository.js";
import { songRepository } from "../repositories/song.repository.js";
import { videoRepository } from "../repositories/video.repository.js";
import { AppError } from "../lib/errors.js";
import type { PlaybackEventBody } from "../validators/event.schema.js";

export type EventOutcome = "ACCEPTED" | "DUPLICATE";

export const eventService = {
  /**
   * Ingests one playback/view/download event. Idempotent: an event whose
   * clientEventId was already processed is reported as DUPLICATE and does not
   * double-count (safe against retries, app restarts, and re-syncs).
   */
  async ingest(userId: string, body: PlaybackEventBody): Promise<EventOutcome> {
    if (body.mediaType === "SONG") {
      const song = await songRepository.findByIdForArtist(body.songId!);
      if (!song) throw AppError.notFound("Song");
    } else {
      const video = await videoRepository.findByIdRef(body.videoId!);
      if (!video) throw AppError.notFound("Video");
    }

    const input: IngestEventInput = {
      clientEventId: body.clientEventId,
      userId,
      eventType: body.eventType,
      songId: body.songId,
      videoId: body.videoId,
      occurredAt: body.occurredAt,
    };
    const accepted = await eventRepository.ingestWithCounters(input);
    return accepted ? "ACCEPTED" : "DUPLICATE";
  },

  /** Batch sync for the mobile offline queue. Never rejects on duplicates. */
  async ingestBatch(
    userId: string,
    events: PlaybackEventBody[],
  ): Promise<{ accepted: number; duplicates: number; invalid: Array<{ clientEventId: string; reason: string }> }> {
    let accepted = 0;
    let duplicates = 0;
    const invalid: Array<{ clientEventId: string; reason: string }> = [];

    // Independent events; safe to process concurrently since each one is
    // individually idempotent (unique clientEventId) and counter bumps are atomic.
    const results = await Promise.all(
      events.map(async (event) => {
        try {
          return await eventService.ingest(userId, event);
        } catch (error) {
          invalid.push({
            clientEventId: event.clientEventId,
            reason: error instanceof AppError ? error.message : "Failed to process event",
          });
          return "INVALID" as const;
        }
      }),
    );

    for (const result of results) {
      if (result === "ACCEPTED") accepted += 1;
      else if (result === "DUPLICATE") duplicates += 1;
    }

    return { accepted, duplicates, invalid };
  },
};
