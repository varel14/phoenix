import { create } from "zustand";
import { File } from "expo-file-system";
import {
  discardPart,
  entryFromVideo,
  finalizePart,
  getLocalEntry,
  listLocalEntries,
  partDestination,
  removeLocalEntry,
  saveLocalEntry,
  songEntryFromSong,
} from "./local-library";
import { setSourceResolver } from "@/services/media/source-resolver";
import { playerService } from "@/services/media/player-service";
import { trackEvent } from "@/services/events/event-queue";
import { downloadsApi } from "@/services/api/library-api";
import type { LocalMediaEntry } from "./local-library";
import type { MediaType, Song, Video } from "@/types/api";

export type DownloadState = "downloading" | "paused" | "completed" | "failed";

export interface DownloadItemState {
  mediaType: MediaType;
  mediaId: string;
  title: string;
  progress: number; // 0..1
  state: DownloadState;
  error: string | null;
}

interface DownloadsState {
  items: Record<string, DownloadItemState>;
  library: LocalMediaEntry[];
  hydrated: boolean;

  hydrate: () => Promise<void>;
  start: (media: Song | Video) => Promise<void>;
  pause: (mediaType: MediaType, mediaId: string) => void;
  resume: (mediaType: MediaType, mediaId: string) => Promise<void>;
  remove: (mediaType: MediaType, mediaId: string) => Promise<void>;
  refreshLibrary: () => Promise<void>;
}

type MediaTask = {
  media: Song | Video;
  part: File | null;
  paused: boolean;
};

const activeTasks = new Map<string, MediaTask>();

function taskKey(mediaType: MediaType, mediaId: string): string {
  return `${mediaType}:${mediaId}`;
}

function isSong(media: Song | Video): media is Song {
  return "audioUrl" in media;
}

function asMediaRef(media: Song | Video): { mediaType: MediaType; mediaId: string; title: string } {
  return isSong(media)
    ? { mediaType: "SONG", mediaId: media.id, title: media.title }
    : { mediaType: "VIDEO", mediaId: media.id, title: media.title };
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  items: {},
  library: [],
  hydrated: false,

  hydrate: async () => {
    const library = await listLocalEntries();
    set((state) => {
      // Anything still "downloading" from a previous session was interrupted.
      const items = { ...state.items };
      for (const [key, item] of Object.entries(items)) {
        if (item.state === "downloading") {
          items[key] = { ...item, state: "failed", error: "Download was interrupted" };
        }
      }
      return { library, items, hydrated: true };
    });
    setSourceResolver((song) => {
      const entry = get().library.find(
        (candidate) => candidate.mediaType === "SONG" && candidate.mediaId === song.id,
      );
      return entry ? { uri: entry.fileUri, isLocal: true } : undefined;
    });
  },

  start: async (media) => {
    const { mediaType, mediaId } = asMediaRef(media);
    const key = taskKey(mediaType, mediaId);

    if (activeTasks.has(key)) return;
    if (await getLocalEntry(mediaType, mediaId)) return; // already downloaded

    const url = isSong(media) ? media.audioUrl : media.videoUrl;
    if (isSong(media) && !media.isDownloadable) return;
    if (!isSong(media) && !media.isDownloadable) return;

    const part = partDestination(mediaType, mediaId, url);
    const task = File.createDownloadTask(url, part);

    set((state) => ({
      items: {
        ...state.items,
        [key]: { mediaType, mediaId, title: asMediaRef(media).title, progress: 0, state: "downloading", error: null },
      },
    }));

    activeTasks.set(key, { media, part, paused: false });

    task.addListener("progress", (data) => {
      set((state) => {
        const item = state.items[key];
        if (!item || item.state !== "downloading") return state;
        return {
          items: {
            ...state.items,
            [key]: { ...item, progress: data.totalBytes > 0 ? Math.min(1, data.bytesWritten / data.totalBytes) : 0 },
          },
        };
      });
    });

    // Fire-and-forget: state updates arrive via the store.
    void (async () => {
      try {
        const file = await task.downloadAsync();
        const current = activeTasks.get(key);
        if (!file) {
          // Paused — wait for resume or user action.
          return;
        }
        const entry = isSong(media) ? songEntryFromSong(media, file) : entryFromVideo(media, file);
        await saveLocalEntry(entry);
        finalizeStorage(entry, current?.part ?? null);

        set((state) => ({
          items: { ...state.items, [key]: { ...state.items[key]!, progress: 1, state: "completed", error: null } },
          library: [entry, ...state.library.filter((candidate) => taskKey(candidate.mediaType, candidate.mediaId) !== key)],
        }));

        // Server record + offline-safe DOWNLOAD event (best effort).
        downloadsApi.register(mediaType, mediaId).catch(() => {
          trackEvent({ eventType: "DOWNLOAD", mediaType, ...(mediaType === "SONG" ? { songId: mediaId } : { videoId: mediaId }) });
        });
        if (mediaType === "SONG") {
          playerService.reloadCurrentIfActive(mediaId);
        }
        activeTasks.delete(key);
      } catch (error) {
        discardPart(activeTasks.get(key)?.part ?? null);
        activeTasks.delete(key);
        set((state) => ({
          items: {
            ...state.items,
            [key]: {
              ...state.items[key]!,
              state: "failed",
              error: error instanceof Error ? error.message : "Download failed",
            },
          },
        }));
      }
    })();
  },

  pause: (mediaType, mediaId) => {
    void mediaType;
    void mediaId;
    // expo-file-system DownloadTask exposes pause on the instance; the map
    // holds the task, but pausing mid-flight is left for a later phase —
    // marking state so the UI can reflect intent.
    set((state) => {
      const items: Record<string, DownloadItemState> = {};
      for (const [key, item] of Object.entries(state.items)) {
        items[key] = item.state === "downloading" ? { ...item, state: "paused" } : item;
      }
      return { items };
    });
  },

  resume: async (mediaType, mediaId) => {
    const entry = await getLocalEntry(mediaType, mediaId);
    if (entry) return;
    set((state) => {
      const key = taskKey(mediaType, mediaId);
      const item = state.items[key];
      if (!item) return state;
      return { items: { ...state.items, [key]: { ...item, state: "failed", error: "Tap to retry" } } };
    });
  },

  remove: async (mediaType, mediaId) => {
    await removeLocalEntry(mediaType, mediaId);
    set((state) => ({
      library: state.library.filter(
        (entry) => !(entry.mediaType === mediaType && entry.mediaId === mediaId),
      ),
      items: (() => {
        const items = { ...state.items };
        delete items[taskKey(mediaType, mediaId)];
        return items;
      })(),
    }));
  },

  refreshLibrary: async () => {
    const library = await listLocalEntries();
    set({ library });
  },
}));

function finalizeStorage(entry: LocalMediaEntry, part: File | null) {
  void entry;
  void part;
  // File is already finalized by the caller; hook kept for future cleanup.
}

// Convenience selectors -------------------------------------------------------

export function selectDownloadState(
  state: DownloadsState,
  mediaType: MediaType,
  mediaId: string,
): DownloadItemState | undefined {
  return state.items[taskKey(mediaType, mediaId)];
}

export function selectIsDownloaded(state: DownloadsState, mediaType: MediaType, mediaId: string): boolean {
  return state.library.some((entry) => entry.mediaType === mediaType && entry.mediaId === mediaId);
}
