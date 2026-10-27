import { Directory, File, Paths } from "expo-file-system";
import { storage as AsyncStorage } from "@/services/storage/mmkv";
import { API_URL } from "@/services/api/api-client";

/**
 * Voice-note cache: a voice message must be fully downloaded before it can
 * play (no partial streaming), and the copy is kept so relistens are instant
 * and free. Files live in the app's cache directory under an LRU budget —
 * safe to clear at any time, unlike the paid downloads library.
 */

interface VoiceEntry {
  storageKey: string;
  fileUri: string;
  sourceUrl: string;
  fileSizeBytes: number;
  downloadedAt: string;
  lastPlayedAt: string;
}

const INDEX_KEY = "phoenix.voice-cache.index";
/** 100 MB of voice notes before the least recently played are evicted. */
const MAX_CACHE_BYTES = 100 * 1024 * 1024;

const memory = new Map<string, VoiceEntry>();
const inFlight = new Map<string, Promise<string>>();
let hydrated = false;

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, "voice-cache");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** "voice/abc.m4a" → "voice-abc.m4a" — storage keys are safe as flat filenames. */
function fileNameFor(storageKey: string, url: string): string {
  const ext = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url)?.[1] ?? "m4a";
  return `${storageKey.replace(/[^a-zA-Z0-9._-]/g, "-")}.${ext}`;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      INDEX_KEY,
      JSON.stringify(Object.fromEntries(memory)),
    );
  } catch {
    // Storage full — the cache still works for this session.
  }
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const index = raw ? (JSON.parse(raw) as Record<string, VoiceEntry>) : {};
    for (const [key, entry] of Object.entries(index)) {
      if (new File(entry.fileUri).exists) memory.set(key, entry);
    }
  } catch {
    // Corrupt index — entries rebuild on next download.
  }
}

/**
 * Attachment url (server-relative or absolute) → the exact URI the player
 * resolves against. Seeding and lookup must agree on this string, since cache
 * entries are matched on it.
 */
export function voiceSourceUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

/**
 * Hands an already-local recording (the clip the user just sent) to the cache:
 * the file is moved into the cache directory and registered under the upload's
 * storage key, so the sent bubble plays instantly instead of re-downloading
 * what is already on disk. Best-effort — on failure the note simply downloads
 * on first play, as before.
 */
export async function seedVoiceNote(params: {
  storageKey: string;
  sourceUrl: string;
  localUri: string;
}): Promise<void> {
  const { storageKey, sourceUrl, localUri } = params;
  if (!storageKey || !sourceUrl || !localUri) return;
  const url = voiceSourceUrl(sourceUrl);
  await hydrate();
  try {
    const local = new File(localUri);
    if (!local.exists) return;
    const previous = memory.get(storageKey);
    if (previous) {
      try {
        const stale = new File(previous.fileUri);
        if (stale.exists) stale.delete();
      } catch {
        // best effort
      }
      memory.delete(storageKey);
    }
    const dest = new File(cacheDir(), fileNameFor(storageKey, url));
    if (dest.exists) dest.delete();
    local.move(dest);
    memory.set(storageKey, {
      storageKey,
      fileUri: dest.uri,
      sourceUrl: url,
      fileSizeBytes: dest.size ?? 0,
      downloadedAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
    });
    await persist();
    void evictIfNeeded();
  } catch {
    // Cache seeding is an optimization — download-on-play still works.
  }
}

/**
 * Resolves a voice note to a local file, downloading it in full first when
 * needed. `onProgress` reports 0..1 during the download. The returned URI is
 * guaranteed to be complete — callers can play it immediately.
 */
export async function resolveVoiceNote(
  url: string,
  storageKey: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  await hydrate();

  const entry = memory.get(storageKey);
  if (entry && entry.sourceUrl === url) {
    entry.lastPlayedAt = new Date().toISOString();
    void persist();
    return entry.fileUri;
  }
  // Stale copy (re-uploaded attachment) — drop it and re-download.
  if (entry) {
    try {
      const stale = new File(entry.fileUri);
      if (stale.exists) stale.delete();
    } catch {
      // best effort
    }
    memory.delete(storageKey);
  }

  const existing = inFlight.get(storageKey);
  if (existing) return existing;

  const download = (async () => {
    const dest = new File(cacheDir(), fileNameFor(storageKey, url));
    if (dest.exists) dest.delete();
    const task = File.createDownloadTask(url, dest);
    task.addListener("progress", (data) => {
      if (data.totalBytes > 0)
        onProgress?.(Math.min(1, data.bytesWritten / data.totalBytes));
    });
    const file = await task.downloadAsync();
    if (!file || !file.exists) throw new Error("Voice note download failed");
    memory.set(storageKey, {
      storageKey,
      fileUri: file.uri,
      sourceUrl: url,
      fileSizeBytes: file.size ?? 0,
      downloadedAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
    });
    onProgress?.(1);
    await persist();
    void evictIfNeeded();
    return file.uri;
  })();

  inFlight.set(storageKey, download);
  try {
    return await download;
  } finally {
    inFlight.delete(storageKey);
  }
}

/** Deletes least recently played notes until the cache fits its budget. */
async function evictIfNeeded(): Promise<void> {
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
    try {
      const file = new File(entry.fileUri);
      if (file.exists) file.delete();
    } catch {
      // already gone
    }
    total -= entry.fileSizeBytes;
    memory.delete(entry.storageKey);
  }
  await persist();
}
