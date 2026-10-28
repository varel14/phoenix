import { create } from "zustand";
import { Alert } from "react-native";
import { router } from "expo-router";
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
import { subscriptionsApi } from "@/services/api/subscriptions-api";
import { ApiError } from "@/services/api/api-client";
import type { LocalMediaEntry } from "./local-library";
import type { MediaType, Song, Video } from "@/types/api";

export type DownloadState = "downloading" | "paused" | "completed" | "failed";

export const SUBSCRIPTION_REQUIRED_MESSAGE =
  "Abonnement requis — abonnez-vous à la page de l'artiste (2 500 FCFA/mois) pour télécharger.";

export const SONG_DOWNLOAD_PRICE_LABEL = "1 FCFA";

/** Blocks the download and offers the subscriptions screen. */
function warnSubscriptionRequired() {
  Alert.alert("Abonnement requis", SUBSCRIPTION_REQUIRED_MESSAGE, [
    { text: "Plus tard", style: "cancel" },
    { text: "S'abonner", onPress: () => router.push("/premium") },
  ]);
}

/** Blocks the download and offers the wallet top-up screen. */
function warnInsufficientBalance() {
  Alert.alert(
    "Solde insuffisant",
    `Le téléchargement d'un titre coûte ${SONG_DOWNLOAD_PRICE_LABEL}. Rechargez votre portefeuille pour continuer.`,
    [
      { text: "Plus tard", style: "cancel" },
      { text: "Recharger", onPress: () => router.push("/pay") },
    ],
  );
}

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

function asMediaRef(media: Song | Video): {
  mediaType: MediaType;
  mediaId: string;
  title: string;
} {
  return isSong(media)
    ? { mediaType: "SONG", mediaId: media.id, title: media.title }
    : { mediaType: "VIDEO", mediaId: media.id, title: media.title };
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
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
          items[key] = {
            ...item,
            state: "failed",
            error: "Download was interrupted",
          };
        }
      }
      return { library, items, hydrated: true };
    });
  },

  start: async (media) => {
    const { mediaType, mediaId } = asMediaRef(media);
    const key = taskKey(mediaType, mediaId);

    if (activeTasks.has(key)) return;
    if (await getLocalEntry(mediaType, mediaId)) return; // already downloaded

    const url = isSong(media) ? media.audioUrl : media.videoUrl;
    if (!media.isDownloadable) return;

    if (isSong(media)) {
      // Pay-per-download: registration charges 1 FCFA from the wallet once
      // (atomically, server-side) and credits the artist. Re-downloads of an
      // owned song return the existing record for free.
      try {
        await downloadsApi.register("SONG", mediaId);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === "INSUFFICIENT_BALANCE"
        ) {
          set((state) => ({
            items: {
              ...state.items,
              [key]: {
                mediaType,
                mediaId,
                title: asMediaRef(media).title,
                progress: 0,
                state: "failed",
                error: `Solde insuffisant — ${SONG_DOWNLOAD_PRICE_LABEL} requis`,
              },
            },
          }));
          warnInsufficientBalance();
          return;
        }
        set((state) => ({
          items: {
            ...state.items,
            [key]: {
              mediaType,
              mediaId,
              title: asMediaRef(media).title,
              progress: 0,
              state: "failed",
              error:
                error instanceof Error
                  ? error.message
                  : "Connexion requise pour acheter ce titre",
            },
          },
        }));
        return;
      }
    } else {
      // Video downloads stay under the page subscription: 2 500 FCFA/month
      // with a 1 FCFA/month royalty per kept download. A network failure
      // (offline, server down) stays permissive here — the authoritative
      // check happens at registration.
      try {
        const status = await subscriptionsApi.getStatus();
        if (!status.subscription || status.subscription.status !== "ACTIVE") {
          set((state) => ({
            items: {
              ...state.items,
              [key]: {
                mediaType,
                mediaId,
                title: asMediaRef(media).title,
                progress: 0,
                state: "failed",
                error: SUBSCRIPTION_REQUIRED_MESSAGE,
              },
            },
          }));
          warnSubscriptionRequired();
          return;
        }
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 401)
        ) {
          set((state) => ({
            items: {
              ...state.items,
              [key]: {
                mediaType,
                mediaId,
                title: asMediaRef(media).title,
                progress: 0,
                state: "failed",
                error: SUBSCRIPTION_REQUIRED_MESSAGE,
              },
            },
          }));
          warnSubscriptionRequired();
          return;
        }
        // Network error — fall through and try; the server decides at registration.
      }
    }

    const part = partDestination(mediaType, mediaId, url);
    const task = File.createDownloadTask(url, part);

    set((state) => ({
      items: {
        ...state.items,
        [key]: {
          mediaType,
          mediaId,
          title: asMediaRef(media).title,
          progress: 0,
          state: "downloading",
          error: null,
        },
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
            [key]: {
              ...item,
              progress:
                data.totalBytes > 0
                  ? Math.min(1, data.bytesWritten / data.totalBytes)
                  : 0,
            },
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
        // Rename the .part to its final name first, so the library entry (and
        // playback) point at the canonical file instead of a partial.
        const finalized =
          current?.part != null
            ? finalizePart(current.part, mediaType, mediaId, url)
            : file;
        const entry = isSong(media)
          ? songEntryFromSong(media, finalized)
          : entryFromVideo(media, finalized);
        await saveLocalEntry(entry);

        set((state) => ({
          items: {
            ...state.items,
            [key]: {
              ...state.items[key]!,
              progress: 1,
              state: "completed",
              error: null,
            },
          },
          library: [
            entry,
            ...state.library.filter(
              (candidate) =>
                taskKey(candidate.mediaType, candidate.mediaId) !== key,
            ),
          ],
        }));

        // Server record + offline-safe DOWNLOAD event (best effort). Songs
        // were already registered (and charged) before the transfer, so only
        // videos register here. A SUBSCRIPTION_REQUIRED rejection means the
        // page subscription lapsed mid-flight: discard the local copy so no
        // video is kept unpaid.
        if (!isSong(media)) {
          try {
            await downloadsApi.register(mediaType, mediaId);
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.code === "SUBSCRIPTION_REQUIRED"
            ) {
              await removeLocalEntry(mediaType, mediaId);
              activeTasks.delete(key);
              set((state) => ({
                library: state.library.filter(
                  (candidate) =>
                    taskKey(candidate.mediaType, candidate.mediaId) !== key,
                ),
                items: {
                  ...state.items,
                  [key]: {
                    ...state.items[key]!,
                    progress: 0,
                    state: "failed",
                    error: SUBSCRIPTION_REQUIRED_MESSAGE,
                  },
                },
              }));
              warnSubscriptionRequired();
              return;
            }
            trackEvent({
              eventType: "DOWNLOAD",
              mediaType,
              ...(mediaType === "SONG"
                ? { songId: mediaId }
                : { videoId: mediaId }),
            });
          }
        }
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
        items[key] =
          item.state === "downloading" ? { ...item, state: "paused" } : item;
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
      return {
        items: {
          ...state.items,
          [key]: { ...item, state: "failed", error: "Tap to retry" },
        },
      };
    });
  },

  remove: async (mediaType, mediaId) => {
    await removeLocalEntry(mediaType, mediaId);
    set((state) => ({
      library: state.library.filter(
        (entry) =>
          !(entry.mediaType === mediaType && entry.mediaId === mediaId),
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

// Convenience selectors -------------------------------------------------------

/**
 * Playback resolver, registered as soon as this module is imported (the app
 * root imports the store) so a track played before the first hydrate completes
 * still finds its downloaded copy. A vanished file (OS cleanup) falls back to
 * the remote stream instead of failing playback.
 */
setSourceResolver(
  (song) => {
    const entry = useDownloadsStore
      .getState()
      .library.find(
        (candidate) =>
          candidate.mediaType === "SONG" && candidate.mediaId === song.id,
      );
    if (!entry) return undefined;
    try {
      if (!new File(entry.fileUri).exists) {
        void useDownloadsStore.getState().refreshLibrary();
        return undefined;
      }
    } catch {
      return undefined;
    }
    return { uri: entry.fileUri, isLocal: true };
  },
  async () => {
    const state = useDownloadsStore.getState();
    if (!state.hydrated) await state.hydrate();
  },
);

export function selectDownloadState(
  state: DownloadsState,
  mediaType: MediaType,
  mediaId: string,
): DownloadItemState | undefined {
  return state.items[taskKey(mediaType, mediaId)];
}

export function selectIsDownloaded(
  state: DownloadsState,
  mediaType: MediaType,
  mediaId: string,
): boolean {
  return state.library.some(
    (entry) => entry.mediaType === mediaType && entry.mediaId === mediaId,
  );
}
