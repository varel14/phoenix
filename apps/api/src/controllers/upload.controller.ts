import type { Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { sendSuccess } from "../lib/responses.js";
import { storeUpload, type UploadKind } from "../lib/object-storage.js";
import type { AuthenticatedUser } from "../types/express.d.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const uploadController = {
  async create(req: Request, res: Response) {
    requireUser(req);
    const file = req.file;
    if (!file) throw AppError.badRequest("A file is required");
    const kind = req.uploadKind as UploadKind;
    // Moves the file into R2 when configured; falls back to local disk.
    const stored = await storeUpload(kind, file);
    sendSuccess(res, {
      kind,
      url: stored.url,
      storageKey: stored.storageKey,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      originalName: file.originalname,
    });
  },
};
