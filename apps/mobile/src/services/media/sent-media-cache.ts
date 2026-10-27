import { File } from "expo-file-system";
import { API_URL } from "@/services/api/api-client";
import { mmkv } from "@/services/storage/mmkv";

/**
 * Sent-attachment reuse: photos and videos the user picks are already on
 * disk, so after the upload the local copy is registered here and bubbles the
 * user sent render from it instead of re-downloading the bytes from the
 * server. Zero-copy — entries point at the picker's file in the app cache,
 * so a missing file (OS cache purge) simply falls back to the remote URL.
 */

interface SentMediaEntry {
  storageKey: string;
  fileUri: string;
  sourceUrl: string;
  seededAt: string;
}

const INDEX_KEY = "phoenix.sent-media.index";
/** Enough recent sends to cover any realistic scrollback. */
const MAX_ENTRIES = 500;

const memory = new Map<string, SentMediaEntry>();
let hydrated = false;

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = mmkv.getString(INDEX_KEY);
    if (!raw) return;
    const index = JSON.parse(raw) as SentMediaEntry[];
    for (const entry of index) memory.set(entry.storageKey, entry);
  } catch {
    // Corrupt index — entries rebuild on next send.
  }
}

function persist(): void {
  try {
    mmkv.set(
      INDEX_KEY,
      JSON.stringify([...memory.values()].slice(-MAX_ENTRIES)),
    );
  } catch {
    // Storage full — the cache still works for this session.
  }
}

/** Drops the oldest entries once the index outgrows its budget. */
function prune(): void {
  if (memory.size <= MAX_ENTRIES) return;
  const oldest = [...memory.values()]
    .sort((a, b) => a.seededAt.localeCompare(b.seededAt))
    .slice(0, memory.size - MAX_ENTRIES);
  for (const entry of oldest) memory.delete(entry.storageKey);
}

/** Attachment url (server-relative or absolute) → the exact URI bubbles render against. */
export function sentMediaSourceUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

/**
 * Registers the local copy of a just-uploaded attachment. Best-effort: on
 * failure the bubble simply loads the remote URL, as before.
 */
export async function seedSentMedia(params: {
  storageKey: string;
  sourceUrl: string;
  localUri: string;
}): Promise<void> {
  const { storageKey, sourceUrl, localUri } = params;
  if (!storageKey || !sourceUrl || !localUri) return;
  try {
    if (!new File(localUri).exists) return;
  } catch {
    return;
  }
  hydrate();
  memory.set(storageKey, {
    storageKey,
    fileUri: localUri,
    sourceUrl: sentMediaSourceUrl(sourceUrl),
    seededAt: new Date().toISOString(),
  });
  prune();
  persist();
}

/**
 * Returns the local file for an attachment the user sent from this device,
 * or null when unknown/stale — callers then fall back to the remote URL.
 */
export function resolveSentMedia(
  storageKey: string,
  remoteUrl: string,
): string | null {
  hydrate();
  const entry = memory.get(storageKey);
  if (!entry || entry.sourceUrl !== remoteUrl) return null;
  try {
    if (!new File(entry.fileUri).exists) {
      memory.delete(storageKey);
      persist();
      return null;
    }
  } catch {
    return null;
  }
  return entry.fileUri;
}
