import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

/** Anchor on this file: apps/api/src/lib -> apps/api. */
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function resolveDir(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(packageRoot, value);
}

/** Absolute path to the public uploads folder (defaults to ../uploads). */
export function uploadsDir(): string {
  const dir = resolveDir(env.UPLOADS_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Absolute path to the protected digital files folder (defaults to ../digital-files).
 * Never mounted by express.static — downloads go through authorized endpoints.
 */
export function digitalFilesDir(): string {
  const dir = resolveDir(env.DIGITAL_FILES_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
