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

/** Registered by the downloads service once it has indexed local files. */
export function setSourceResolver(next: SourceResolver | null) {
  resolver = next;
}

export function resolveSongSource(song: Song): ResolvedSource {
  const local = resolver?.(song);
  if (local) return local;
  return { uri: song.audioUrl, isLocal: false };
}
