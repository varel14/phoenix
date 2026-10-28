import type { Song } from "@/types/api";

/**
 * Playback source resolution: prefer the downloaded local file (offline
 * playback), fall back to the remote stream URL.
 */
export interface ResolvedSource {
  uri: string;
  isLocal: boolean;
}

export type SourceResolver = (song: Song) => ResolvedSource | undefined;

let resolver: SourceResolver | null = null;
let ensureReadyFn: (() => Promise<void>) | null = null;

/**
 * Registered by the downloads service at import time. `ensureReady` lets the
 * player wait for the local library index before resolving, so a track played
 * right after cold start still finds its downloaded copy.
 */
export function setSourceResolver(
  next: SourceResolver | null,
  ensureReady?: () => Promise<void>,
) {
  resolver = next;
  ensureReadyFn = ensureReady ?? null;
}

/** Waits for the resolver's backing index (downloaded library) to be loaded. */
export async function ensureSourcesReady(): Promise<void> {
  if (!ensureReadyFn) return;
  await ensureReadyFn().catch(() => undefined);
}

export function resolveSongSource(song: Song): ResolvedSource {
  const local = resolver?.(song);
  if (local) return local;
  return { uri: song.audioUrl, isLocal: false };
}
