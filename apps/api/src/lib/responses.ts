import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function sendSuccess<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data });
}

export function sendPaginated<T>(res: Response, data: T[], pagination: PaginationMeta): Response {
  return res.status(200).json({ data, pagination });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}
