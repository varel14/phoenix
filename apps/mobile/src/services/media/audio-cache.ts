import { Directory, File, Paths } from "expo-file-system";
import { storage as AsyncStorage } from "@/services/storage/mmkv";
import type { Song } from "@/types/api";

/**
 * Playback cache: the first stream of a song lands a copy in the app's cache
 * directory (in the background, without interrupting playback) so every later
 * listen plays from disk — instant start, zero data. Distinct from the paid
 * downloads library (documents dir, permanent, user-managed): this cache is
 * transparent, evicted least-recently-played once it outgrows its budget, and
 * safe to clear at any time.
 *
 * Each entry also keeps the song's metadata (full Song payload) and a local
 * copy of its thumbnail, so the latest listened songs render completely
 * offline. Thumbnails live in their own pool with a much looser eviction
 * policy — they are tiny, so they outlive the audio entries they came from.
 */

export interface AudioCacheEntry {
  songId: string;
  fileUri: string;
  sourceUrl: string;
  fileSizeBytes: number;
  cachedAt: string;
  lastPlayedAt: string;
  /** Full Song payload — title, artist, artwork URL, duration… */
  metadata: Song | null;
  /** Local thumbnail copy; survives audio eviction (see thumb pool). */
  thumbUri: string | null;
}

interface ThumbEntry {
  songId: string;
  fileUri: string;
  cachedAt: string;
  lastPlayedAt: string;
}

const INDEX_KEY = "phoenix.audio-cache.index";
const THUMB_INDEX_KEY = "phoenix.audio-cache.thumbs";
/** 200 MB of cached audio before the least recently played files are evicted. */
const MAX_CACHE_BYTES = 200 * 1024 * 1024;
/** The X latest listened songs are always kept, regardless of byte budget. */
const RECENT_SONG_LIMIT = 20;
/** Thumbnails are tiny — keep a large pool, evicted only past this count. */
const THUMB_LIMIT = 200;

const memory = new Map<string, AudioCacheEntry>();
const thumbs = new Map<string, ThumbEntry>();
const inFlight = new Set<string>();
const thumbsInFlight = new Set<string>();
let hydrated = false;

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, "audio-cache");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function thumbDir(): Directory {
  const dir = new Directory(Paths.cache, "audio-cache/thumbnails");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

async function readIndex<T>(key: string): Promise<Record<string, T>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      INDEX_KEY,
      JSON.stringify(Object.fromEntries(memory)),
    );
    await AsyncStorage.setItem(
      THUMB_INDEX_KEY,
      JSON.stringify(Object.fromEntries(thumbs)),
    );
  } catch {
    // Storage full — the cache still works for this session.
  }
}

function fileExtensionFor(url: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url);
  return match?.[1] ?? "mp3";
}

/** Loads both indexes, drops entries whose files vanished, enforces budgets. */
export async function hydrateAudioCache(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  const index = await readIndex<AudioCacheEntry>(INDEX_KEY);
  for (const [songId, entry] of Object.entries(index)) {
    if (new File(entry.fileUri).exists) {
      memory.set(songId, {
        ...entry,
        // Metadata/thumb are newer fields — tolerate old index payloads.
        metadata: entry.metadata ?? null,
        thumbUri:
          entry.thumbUri && new File(entry.thumbUri).exists
            ? entry.thumbUri
            : null,
      });
    }
  }
  const thumbIndex = await readIndex<ThumbEntry>(THUMB_INDEX_KEY);
  for (const [songId, entry] of Object.entries(thumbIndex)) {
    if (new File(entry.fileUri).exists) {
      thumbs.set(songId, entry);
    } else {
      const audioEntry = memory.get(songId);
      if (audioEntry) audioEntry.thumbUri = null;
    }
  }
  await evictIfNeeded();
}

/** Synchronous lookup used by the player on the hot path. */
export function getCachedAudioUri(songId: string): string | null {
  return memory.get(songId)?.fileUri ?? null;
}

/** Local thumbnail for a song, if one has been cached. */
export function getCachedThumbUri(songId: string): string | null {
  return thumbs.get(songId)?.fileUri ?? null;
}

/** Metadata for cached songs, most recently listened first. */
export function latestCachedSongs(limit = RECENT_SONG_LIMIT): Song[] {
  return [...memory.values()]
    .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt))
    .slice(0, limit)
    .map((entry) => entry.metadata)
    .filter((song): song is Song => song !== null);
}

/**
 * Records a play: refreshes the entry's recency (eviction ordering), starts
 * the background audio download for not-yet-cached songs, and mirrors the
 * thumbnail into the aggressive thumb pool. Never throws.
 */
export async function noteAudioPlayback(song: Song): Promise<void> {
  try {
    const entry = memory.get(song.id);
    if (entry) {
      // A re-uploaded track has a new URL — drop the stale copy.
      if (entry.sourceUrl === song.audioUrl) {
        entry.lastPlayedAt = new Date().toISOString();
        entry.metadata = song; // freshest metadata for offline rendering
        await persist();
      } else {
        try {
          if (new File(entry.fileUri).exists) new File(entry.fileUri).delete();
        } catch {
          // best effort
        }
        memory.delete(song.id);
        await persist();
      }
    }
    if (!inFlight.has(song.id)) {
      inFlight.add(song.id);
      void cacheSong(song).finally(() => inFlight.delete(song.id));
    }
    void cacheThumb(song);
  } catch {
    // Caching is best-effort; playback must never depend on it.
  }
}

async function cacheSong(song: Song): Promise<void> {
  try {
    const dest = new File(
      cacheDir(),
      `song-${song.id}.${fileExtensionFor(song.audioUrl)}`,
    );
    if (dest.exists) dest.delete();
    const task = File.createDownloadTask(song.audioUrl, dest);
    const file = await task.downloadAsync();
    if (!file || !file.exists) return;
    const existing = memory.get(song.id);
    memory.set(song.id, {
      songId: song.id,
      fileUri: file.uri,
      sourceUrl: song.audioUrl,
      fileSizeBytes: file.size ?? 0,
      cachedAt: existing?.cachedAt ?? new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
      metadata: song,
      thumbUri: existing?.thumbUri ?? thumbs.get(song.id)?.fileUri ?? null,
    });
    await persist();
    await evictIfNeeded(song.id);
  } catch {
    // Offline / expired URL / disk full — the remote stream keeps working.
  }
}

/** Mirrors the artwork into the long-lived thumb pool (tiny files). */
async function cacheThumb(song: Song): Promise<void> {
  try {
    if (!song.thumbnailUrl || thumbs.has(song.id)) {
      bumpThumbRecency(song.id);
      return;
    }
    if (thumbsInFlight.has(song.id)) return;
    thumbsInFlight.add(song.id);
    try {
      const dest = new File(
        thumbDir(),
        `thumb-${song.id}.${fileExtensionFor(song.thumbnailUrl)}`,
      );
      if (dest.exists) dest.delete();
      const task = File.createDownloadTask(song.thumbnailUrl, dest);
      const file = await task.downloadAsync();
      if (file && file.exists) {
        thumbs.set(song.id, {
          songId: song.id,
          fileUri: file.uri,
          cachedAt: new Date().toISOString(),
          lastPlayedAt: new Date().toISOString(),
        });
        const entry = memory.get(song.id);
        if (entry) entry.thumbUri = file.uri;
        await persist();
        await evictThumbs();
      }
    } finally {
      thumbsInFlight.delete(song.id);
    }
  } catch {
    // Artwork is cosmetic — never fail playback for it.
  }
}

function bumpThumbRecency(songId: string): void {
  const thumb = thumbs.get(songId);
  if (thumb) thumb.lastPlayedAt = new Date().toISOString();
}

/** Deletes least recently played entries until the cache fits its budget. */
async function evictIfNeeded(justCachedSongId?: string): Promise<void> {
  let total = [...memory.values()].reduce(
    (sum, entry) => sum + entry.fileSizeBytes,
    0,
  );
  const byAge = [...memory.values()].sort((a, b) =>
    a.lastPlayedAt.localeCompare(b.lastPlayedAt),
  );

  // The X latest listened songs are pinned; everything past the budget or
  // the count limit is evicted oldest-first. Thumbnails intentionally
  // survive audio eviction — they live in their own pool below.
  for (const entry of byAge) {
    if (total <= MAX_CACHE_BYTES) break;
    if (entry.songId === justCachedSongId) continue; // never evict what was just played
    try {
      const file = new File(entry.fileUri);
      if (file.exists) file.delete();
    } catch {
      // already gone
    }
    total -= entry.fileSizeBytes;
    memory.delete(entry.songId);
  }
  while (memory.size > RECENT_SONG_LIMIT) {
    const oldest = byAge.find((entry) => memory.has(entry.songId));
    if (!oldest) break;
    if (oldest.songId === justCachedSongId) break; // pinned below anyway
    try {
      const file = new File(oldest.fileUri);
      if (file.exists) file.delete();
    } catch {
      // already gone
    }
    memory.delete(oldest.songId);
  }
  await evictThumbs();
  await persist();
}

/** Thumbnails are kept aggressively: only pruned past THUMB_LIMIT entries. */
async function evictThumbs(): Promise<void> {
  if (thumbs.size <= THUMB_LIMIT) return;
  const byAge = [...thumbs.values()].sort((a, b) =>
    a.lastPlayedAt.localeCompare(b.lastPlayedAt),
  );
  for (const entry of byAge) {
    if (thumbs.size <= THUMB_LIMIT) break;
    try {
      const file = new File(entry.fileUri);
      if (file.exists) file.delete();
    } catch {
      // already gone
    }
    thumbs.delete(entry.songId);
    const audioEntry = memory.get(entry.songId);
    if (audioEntry) audioEntry.thumbUri = null;
  }
}

/** Wipes the whole playback cache (settings entry point). */
export async function clearAudioCache(): Promise<void> {
  for (const entry of memory.values()) {
    try {
      const file = new File(entry.fileUri);
      if (file.exists) file.delete();
    } catch {
      // best effort
    }
  }
  for (const entry of thumbs.values()) {
    try {
      const file = new File(entry.fileUri);
      if (file.exists) file.delete();
    } catch {
      // best effort
    }
  }
  memory.clear();
  thumbs.clear();
  await persist();
}

/** Total cached audio bytes — for a future storage settings readout. */
export function audioCacheBytes(): number {
  return [...memory.values()].reduce(
    (sum, entry) => sum + entry.fileSizeBytes,
    0,
  );
}
