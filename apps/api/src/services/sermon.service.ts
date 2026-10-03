import { sermonRepository, type ListSermonsOptions, type SermonWithRelations } from "../repositories/prayer.repository.js";
import { AppError } from "../lib/errors.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type { ListSermonsQuery } from "../validators/sermon.schema.js";

export const sermonService = {
  async list(query: ListSermonsQuery): Promise<{ sermons: SermonWithRelations[]; pagination: PaginationMeta }> {
    const options: ListSermonsOptions = {
      page: query.page,
      limit: query.limit,
      categoryId: query.categoryId,
      q: query.q,
    };
    const [sermons, total] = await Promise.all([
      sermonRepository.findMany(options),
      sermonRepository.count(options),
    ]);
    return { sermons, pagination: buildPagination(query.page, query.limit, total) };
  },

  async getById(id: string): Promise<SermonWithRelations> {
    const sermon = await sermonRepository.findById(id);
    // Drafts/hidden sermons never surface through the public catalogue.
    if (!sermon || sermon.status !== "PUBLISHED") throw AppError.notFound("Sermon");
    return sermon;
  },
};
