import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { uploadController } from "../controllers/upload.controller.js";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { digitalFilesDir, uploadsDir } from "../lib/storage.js";
import { requireAuth } from "../middleware/auth.js";

const AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
  "audio/m4a",
]);

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"]);

const DIGITAL_MIME_TYPES = new Set(["application/pdf", "application/epub+zip", "application/zip", ...AUDIO_MIME_TYPES]);

/** Generic documents allowed as chat FILE messages. */
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const FILE_EXTENSIONS: Record<string, string> = {
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/m4a": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
  "video/x-matroska": ".mkv",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "application/epub+zip": ".epub",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
};

const ALLOWED_KINDS = new Set(["voice", "audio", "video", "image", "file", "digital"]);

function resolveKind(req: Request): string {
  const kind = (req.query["kind"] ?? req.body?.kind) as string | undefined;
  if (!kind || !ALLOWED_KINDS.has(kind)) {
    throw AppError.badRequest("kind must be one of: voice, audio, video, image, file, digital");
  }
  return kind;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    cb(null, req.uploadKind === "digital" ? digitalFilesDir() : uploadsDir());
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || FILE_EXTENSIONS[file.mimetype] || "";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    try {
      const kind = resolveKind(req);
      if (kind === "voice" && !AUDIO_MIME_TYPES.has(file.mimetype)) {
        cb(AppError.unprocessable("Only audio files are allowed for voice messages"));
        return;
      }
      if (kind === "audio" && !AUDIO_MIME_TYPES.has(file.mimetype)) {
        cb(AppError.unprocessable("Only audio files are allowed for songs"));
        return;
      }
      if (kind === "video" && !VIDEO_MIME_TYPES.has(file.mimetype)) {
        cb(AppError.unprocessable("Only video files are allowed for videos"));
        return;
      }
      if (kind === "image" && !IMAGE_MIME_TYPES.has(file.mimetype)) {
        cb(AppError.unprocessable("Only image files are allowed"));
        return;
      }
      if (kind === "file" && !DOCUMENT_MIME_TYPES.has(file.mimetype)) {
        cb(AppError.unprocessable("This file type is not allowed"));
        return;
      }
      if (kind === "digital" && !DIGITAL_MIME_TYPES.has(file.mimetype)) {
        cb(AppError.unprocessable("This file type is not allowed for digital products"));
        return;
      }
      cb(null, true);
    } catch (error) {
      cb(error as Error);
    }
  },
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

export const uploadRouter = Router();

uploadRouter.post(
  "/",
  requireAuth,
  (req, _res, next) => {
    try {
      req.uploadKind = resolveKind(req);
      next();
    } catch (error) {
      next(error);
    }
  },
  upload.single("file"),
  uploadController.create,
);
