import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

/** Absolute path to the thumbnails folder (defaults to ../thumbnails). */
export function thumbnailsDir(): string {
  if (path.isAbsolute(env.THUMBNAILS_DIR)) return env.THUMBNAILS_DIR;
  // Anchor on this file: apps/api/src/lib -> apps/api -> apps -> <dir>
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  return path.resolve(packageRoot, env.THUMBNAILS_DIR);
}

/** Image filenames available in the thumbnails folder (empty when missing). */
export function listThumbnailFiles(): string[] {
  const dir = thumbnailsDir();
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  } catch {
    return [];
  }
}
