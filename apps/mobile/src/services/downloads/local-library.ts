import { Directory, File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MediaType, Song, Video } from "@/types/api";

/**
 * Local media library. Metadata index lives in AsyncStorage; files live in
 * the app's documents directory. One file per media item — no duplicates.
 *
 * The storage implementation sits behind this module so it can later move
 * to SQLite or a native player library cache without touching callers.
 */

export interface LocalMediaEntry {
  mediaType: MediaType;
  mediaId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  durationSec: number | null;
  sourceUrl: string;
  fileUri: string;
  fileSizeBytes: number | null;
  downloadedAt: string;
}

const INDEX_KEY = "phoenix.downloads.index";

function downloadsDir(): Directory {
  const dir = new Directory(Paths.document, "downloads");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function fileExtensionFor(url: string, fallback: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url);
  return match?.[1] ?? fallback;
}

export function localFileName(mediaType: MediaType, mediaId: string, url: string): string {
  const ext = fileExtensionFor(url, mediaType === "SONG" ? "mp3" : "mp4");
  return `${mediaType.toLowerCase()}-${mediaId}.${ext}`;
}

export async function readIndex(): Promise<Record<string, LocalMediaEntry>> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalMediaEntry>) : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: Record<string, LocalMediaEntry>): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function entryKey(mediaType: MediaType, mediaId: string): string {
  return `${mediaType}:${mediaId}`;
}

export async function getLocalEntry(mediaType: MediaType, mediaId: string): Promise<LocalMediaEntry | null> {
  const index = await readIndex();
  const entry = index[entryKey(mediaType, mediaId)];
  if (!entry) return null;
  // The index can outlive a file (e.g. OS cache cleanup) — verify presence.
  if (!new File(entry.fileUri).exists) {
    await removeLocalEntry(mediaType, mediaId);
    return null;
  }
  return entry;
}

export async function saveLocalEntry(entry: LocalMediaEntry): Promise<void> {
  const index = await readIndex();
  index[entryKey(entry.mediaType, entry.mediaId)] = entry;
  await writeIndex(index);
}

export async function removeLocalEntry(mediaType: MediaType, mediaId: string): Promise<void> {
  const index = await readIndex();
  const key = entryKey(mediaType, mediaId);
  const entry = index[key];
  if (entry) {
    try {
      if (new File(entry.fileUri).exists) {
        new File(entry.fileUri).delete();
      }
    } catch {
      // file already gone
    }
    delete index[key];
    await writeIndex(index);
  }
}

export async function listLocalEntries(): Promise<LocalMediaEntry[]> {
  const index = await readIndex();
  const entries: LocalMediaEntry[] = [];
  for (const entry of Object.values(index)) {
    if (new File(entry.fileUri).exists) {
      entries.push(entry);
    } else {
      await removeLocalEntry(entry.mediaType, entry.mediaId);
    }
  }
  return entries.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
}

/** Destination path for a partial download (renamed on completion). */
export function partDestination(mediaType: MediaType, mediaId: string, url: string): File {
  return new File(downloadsDir(), `${localFileName(mediaType, mediaId, url)}.part`);
}

export function finalizePart(part: File, mediaType: MediaType, mediaId: string, url: string): File {
  const final = new File(downloadsDir(), localFileName(mediaType, mediaId, url));
  if (final.exists) final.delete();
  part.move(final);
  return final;
}

export function discardPart(part: File | null): void {
  try {
    if (part && part.exists) part.delete();
  } catch {
    // best effort cleanup
  }
}

export function songEntryFromSong(song: Song, file: File): LocalMediaEntry {
  return {
    mediaType: "SONG",
    mediaId: song.id,
    title: song.title,
    artistName: song.artist.name,
    artworkUrl: song.thumbnailUrl,
    durationSec: song.durationSec,
    sourceUrl: song.audioUrl,
    fileUri: file.uri,
    fileSizeBytes: file.size ?? null,
    downloadedAt: new Date().toISOString(),
  };
}

export function entryFromVideo(video: Video, file: File): LocalMediaEntry {
  return {
    mediaType: "VIDEO",
    mediaId: video.id,
    title: video.title,
    artistName: video.artist.name,
    artworkUrl: video.thumbnailUrl,
    durationSec: video.durationSec,
    sourceUrl: video.videoUrl,
    fileUri: file.uri,
    fileSizeBytes: file.size ?? null,
    downloadedAt: new Date().toISOString(),
  };
}
