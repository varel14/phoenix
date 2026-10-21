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
 */

interface CacheEntry {
  songId: string;
  fileUri: string;
  sourceUrl: string;
  fileSizeBytes: number;
  cachedAt: string;
  lastPlayedAt: string;
}

const INDEX_KEY = "phoenix.audio-cache.index";
/** 200 MB of cached audio before the least recently played files are evicted. */
const MAX_CACHE_BYTES = 200 * 1024 * 1024;

const memory = new Map<string, CacheEntry>();
const inFlight = new Set<string>();
let hydrated = false;

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, "audio-cache");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

async function readIndex(): Promise<Record<string, CacheEntry>> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

async function persist(): Promise<void> {
  const index = Object.fromEntries(memory);
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Storage full — the cache still works for this session.
  }
}

function fileExtensionFor(url: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url);
  return match?.[1] ?? "mp3";
}

/** Loads the index, drops entries whose files vanished, enforces the budget. */
export async function hydrateAudioCache(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  const index = await readIndex();
  for (const [songId, entry] of Object.entries(index)) {
    if (new File(entry.fileUri).exists) {
      memory.set(songId, entry);
    }
  }
  await evictIfNeeded();
}

/** Synchronous lookup used by the player on the hot path. */
export function getCachedAudioUri(songId: string): string | null {
  return memory.get(songId)?.fileUri ?? null;
}

/**
 * Records a play: refreshes the entry's recency (eviction ordering) and
 * starts the background download for not-yet-cached songs. Never throws.
 */
export async function noteAudioPlayback(song: Song): Promise<void> {
  try {
    const entry = memory.get(song.id);
    if (entry) {
      // A re-uploaded track has a new URL — drop the stale copy.
      if (entry.sourceUrl === song.audioUrl) {
        entry.lastPlayedAt = new Date().toISOString();
        await persist();
        return;
      }
      try {
        if (new File(entry.fileUri).exists) new File(entry.fileUri).delete();
      } catch {
        // best effort
      }
      memory.delete(song.id);
      await persist();
    }
    if (!inFlight.has(song.id)) {
      inFlight.add(song.id);
      void cacheSong(song).finally(() => inFlight.delete(song.id));
    }
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
    memory.set(song.id, {
      songId: song.id,
      fileUri: file.uri,
      sourceUrl: song.audioUrl,
      fileSizeBytes: file.size ?? 0,
      cachedAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
    });
    await persist();
    await evictIfNeeded(song.id);
  } catch {
    // Offline / expired URL / disk full — the remote stream keeps working.
  }
}

/** Deletes least recently played entries until the cache fits its budget. */
async function evictIfNeeded(justCachedSongId?: string): Promise<void> {
  let total = [...memory.values()].reduce(
    (sum, entry) => sum + entry.fileSizeBytes,
    0,
  );
  if (total <= MAX_CACHE_BYTES) return;

  const byAge = [...memory.values()].sort((a, b) =>
    a.lastPlayedAt.localeCompare(b.lastPlayedAt),
  );
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
  await persist();
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
  memory.clear();
  await persist();
}

/** Total cached bytes — for a future storage settings readout. */
export function audioCacheBytes(): number {
  return [...memory.values()].reduce(
    (sum, entry) => sum + entry.fileSizeBytes,
    0,
  );
}
