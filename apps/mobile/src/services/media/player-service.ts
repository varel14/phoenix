import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { resolveSongSource } from "./source-resolver";
import { usePlayerStore } from "@/stores/player-store";
import { trackEvent } from "@/services/events/event-queue";
import type { Song } from "@/types/api";

/**
 * Global music player. One AudioPlayer instance for the whole app — the
 * mini player and the now-playing screen are just views onto this service.
 *
 * The architecture is intentionally isolated behind this module: future
 * multi-zone playback / equalizers can swap the implementation without
 * touching UI code (stores + resolvers stay the same).
 */
let player: AudioPlayer | null = null;
let subscription: { remove: () => void } | null = null;
let currentSourceKey: string | null = null;

async function ensureAudioMode() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldPlayInBackground: true,
    });
  } catch {
    // Non-fatal (web): playback still works in the foreground.
  }
}

function ensurePlayer(): AudioPlayer {
  if (player) return player;
  player = createAudioPlayer(null);
  subscription = player.addListener("playbackStatusUpdate", (status) => {
    const store = usePlayerStore.getState();
    if (status.didJustFinish) {
      next();
      return;
    }
    store.setProgress(status.currentTime, status.duration, status.isBuffering);
    if (status.playing !== store.isPlaying) {
      store.setPlaying(status.playing);
    }
    if (status.playbackState === "loaded" && store.status === "loading") {
      store.setStatus("ready");
    }
  });
  return player;
}

function load(song: Song) {
  const p = ensurePlayer();
  const store = usePlayerStore.getState();
  const source = resolveSongSource(song);

  try {
    currentSourceKey = song.id;
    store.setStatus("loading");
    store.setError(null);
    store.setOfflinePlayback(source.isLocal);
    p.replace({ uri: source.uri });
    p.play();
    store.setPlaying(true);
    trackEvent({ eventType: "PLAY", mediaType: "SONG", songId: song.id });
  } catch {
    store.setStatus("error");
    store.setError("This track could not be played");
  }
}

export const playerService = {
  /** Plays a queue of songs starting at the given index. */
  async playQueue(queue: Song[], index = 0) {
    if (queue.length === 0) return;
    await ensureAudioMode();
    const store = usePlayerStore.getState();
    store.setQueue(queue, index);
    load(queue[index]!);
  },

  async playSingle(song: Song) {
    await playerService.playQueue([song], 0);
  },

  togglePlay() {
    const p = player;
    const store = usePlayerStore.getState();
    if (!p || store.status === "idle") return;
    if (store.isPlaying) {
      p.pause();
      store.setPlaying(false);
    } else {
      p.play();
      store.setPlaying(true);
    }
  },

  seek(seconds: number) {
    player?.seekTo(Math.max(0, seconds));
  },

  next() {
    const store = usePlayerStore.getState();
    if (store.index < store.queue.length - 1) {
      store.setIndex(store.index + 1);
      load(store.queue[store.index + 1]!);
    } else {
      store.setPlaying(false);
      player?.pause();
    }
  },

  previous() {
    const store = usePlayerStore.getState();
    // Industry convention: restart current track first.
    if (store.currentTime > 3 || store.index === 0) {
      playerService.seek(0);
      return;
    }
    store.setIndex(store.index - 1);
    load(store.queue[store.index - 1]!);
  },

  /** Swaps the resolved source of the current track (e.g. after a download finished). */
  reloadCurrentIfActive(songId: string) {
    const store = usePlayerStore.getState();
    const current = store.queue[store.index];
    if (current && current.id === songId && currentSourceKey === songId) {
      const wasPlaying = store.isPlaying;
      load(current);
      if (!wasPlaying) {
        player?.pause();
        store.setPlaying(false);
      }
    }
  },

  stop() {
    player?.pause();
    usePlayerStore.getState().reset();
  },

  /** Release native resources (called on app teardown if ever needed). */
  dispose() {
    subscription?.remove();
    player?.remove();
    player = null;
    subscription = null;
  },
};

const { next } = playerService;
