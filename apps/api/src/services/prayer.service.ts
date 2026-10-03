import { Prisma } from "./../generated/prisma/client.js";
import {
  prayerRepository,
  type ListPrayersOptions,
  type PrayerWithRelations,
} from "../repositories/prayer.repository.js";
import { AppError } from "../lib/errors.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import { recordActivity } from "../lib/audit.js";
import type { CreatePrayerBody, ListPrayerFavoritesQuery, ListPrayersQuery, UpdatePrayerBody } from "../validators/prayer.schema.js";

export type Actor = { id: string; role: "USER" | "ARTIST" | "ADMIN" };

export interface PrayerView {
  prayer: PrayerWithRelations;
  isFavorite: boolean;
}

function ensureCanManage(prayer: { authorId: string }, actor: Actor): void {
  if (actor.role === "ADMIN") return;
  if (prayer.authorId !== actor.id) throw AppError.forbidden("You can only manage your own prayers");
}

/** Detail visibility: everyone sees published prayers; drafts/hidden only for author or admin. */
function ensureCanView(prayer: PrayerWithRelations, actor: Actor | null): void {
  if (prayer.status === "PUBLISHED") return;
  if (!actor) throw AppError.notFound("Prayer");
  if (actor.role !== "ADMIN" && prayer.authorId !== actor.id) throw AppError.notFound("Prayer");
}

function decorate(prayer: PrayerWithRelations, favoriteIds: Set<string>): PrayerView {
  return { prayer, isFavorite: favoriteIds.has(prayer.id) };
}

export const prayerService = {
  // ------------------------------------------------------------------ feed
  async list(
    query: ListPrayersQuery,
    viewer: Actor | null,
  ): Promise<{ prayers: PrayerView[]; pagination: PaginationMeta }> {
    const options: ListPrayersOptions = {
      page: query.page,
      limit: query.limit,
      categoryId: query.categoryId,
      authorId: query.authorId,
      q: query.q,
      scope: query.scope,
    };
    if (options.scope === "MINE") {
      if (!viewer) throw AppError.unauthorized();
      options.authorId = viewer.id;
    }
    const [prayers, total] = await Promise.all([
      prayerRepository.findMany(options),
      prayerRepository.count(options),
    ]);
    const favoriteIds = viewer
      ? await prayerRepository.favoriteIdsForUser(viewer.id, prayers.map((prayer) => prayer.id))
      : new Set<string>();
    return {
      prayers: prayers.map((prayer) => decorate(prayer, favoriteIds)),
      pagination: buildPagination(query.page, query.limit, total),
    };
  },

  async getById(id: string, viewer: Actor | null): Promise<PrayerView> {
    const prayer = await prayerRepository.findById(id);
    if (!prayer) throw AppError.notFound("Prayer");
    ensureCanView(prayer, viewer);
    const favoriteIds = viewer
      ? await prayerRepository.favoriteIdsForUser(viewer.id, [prayer.id])
      : new Set<string>();
    return decorate(prayer, favoriteIds);
  },

  // ------------------------------------------------------------- mutations
  async create(actor: Actor, body: CreatePrayerBody): Promise<PrayerView> {
    const category = await prayerRepository.findCategoryById(body.categoryId);
    if (!category || !category.isActive) throw AppError.badRequest("Unknown prayer category");

    const prayer = await prayerRepository.create(actor.id, {
      title: body.title,
      content: body.content ?? null,
      categoryId: body.categoryId,
      audioUrl: body.audioUrl ?? null,
      audioStorageKey: body.audioStorageKey ?? null,
      audioDurationSec: body.audioDurationSec ?? null,
      status: body.status,
      publishedAt: body.status === "PUBLISHED" ? new Date() : null,
    });
    return decorate(prayer, new Set());
  },

  async update(actor: Actor, id: string, body: UpdatePrayerBody): Promise<PrayerView> {
    const prayer = await prayerRepository.findById(id);
    if (!prayer) throw AppError.notFound("Prayer");
    ensureCanManage(prayer, actor);

    if (body.categoryId && body.categoryId !== prayer.categoryId) {
      const category = await prayerRepository.findCategoryById(body.categoryId);
      if (!category || !category.isActive) throw AppError.badRequest("Unknown prayer category");
    }

    const updated = await prayerRepository.update(id, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.audioUrl !== undefined ? { audioUrl: body.audioUrl } : {}),
      ...(body.audioStorageKey !== undefined ? { audioStorageKey: body.audioStorageKey } : {}),
      ...(body.audioDurationSec !== undefined ? { audioDurationSec: body.audioDurationSec } : {}),
      ...(body.status !== undefined && body.status !== prayer.status
        ? { status: body.status, publishedAt: body.status === "PUBLISHED" ? new Date() : null }
        : {}),
    });
    const favoriteIds = await prayerRepository.favoriteIdsForUser(actor.id, [id]);
    return decorate(updated, favoriteIds);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    const prayer = await prayerRepository.findById(id);
    if (!prayer) throw AppError.notFound("Prayer");
    ensureCanManage(prayer, actor);
    await prayerRepository.remove(id);
    if (actor.role === "ADMIN" && prayer.authorId !== actor.id) {
      await recordActivity({
        actorId: actor.id,
        action: "PRAYER_DELETED",
        entityType: "prayer",
        entityId: id,
        metadata: { title: prayer.title, authorId: prayer.authorId },
      });
    }
  },

  // ------------------------------------------------------------ moderation
  async moderate(actor: Actor, id: string, status: "PUBLISHED" | "HIDDEN"): Promise<PrayerWithRelations> {
    if (actor.role !== "ADMIN") throw AppError.forbidden("This action requires an administrator");
    const prayer = await prayerRepository.findById(id);
    if (!prayer) throw AppError.notFound("Prayer");
    const updated = await prayerRepository.setStatus(id, status);
    await recordActivity({
      actorId: actor.id,
      action: status === "HIDDEN" ? "PRAYER_HIDDEN" : "PRAYER_RESTORED",
      entityType: "prayer",
      entityId: id,
      metadata: { title: prayer.title },
    });
    return updated;
  },

  // ------------------------------------------------------------- favorites
  async listFavorites(
    userId: string,
    query: ListPrayerFavoritesQuery,
  ): Promise<{ prayers: PrayerWithRelations[]; pagination: PaginationMeta }> {
    const [prayers, total] = await Promise.all([
      prayerRepository.listFavorites(userId, query),
      prayerRepository.countFavorites(userId),
    ]);
    return { prayers, pagination: buildPagination(query.page, query.limit, total) };
  },

  async addFavorite(userId: string, prayerId: string): Promise<void> {
    const prayer = await prayerRepository.findById(prayerId);
    if (!prayer || prayer.status !== "PUBLISHED") throw AppError.notFound("Prayer");
    try {
      await prayerRepository.addFavorite(userId, prayerId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw AppError.conflict("Prayer is already in your favorites");
      }
      throw error;
    }
  },

  async removeFavorite(userId: string, prayerId: string): Promise<void> {
    const removed = await prayerRepository.removeFavorite(userId, prayerId);
    if (removed === 0) throw AppError.notFound("Favorite");
  },

  // ------------------------------------------------------------ categories
  listCategories(options: { activeOnly: boolean }) {
    return prayerRepository.listCategories(options);
  },
};
