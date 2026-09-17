import { create } from "zustand";
import type { Song } from "@/types/api";

export type PlayerStatus = "idle" | "loading" | "ready" | "error";

interface PlayerState {
  queue: Song[];
  index: number;
  status: PlayerStatus;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  /** Local file URI when the current track is available offline. */
  isOfflinePlayback: boolean;

  setQueue: (queue: Song[], index: number) => void;
  setIndex: (index: number) => void;
  setStatus: (status: PlayerStatus) => void;
  setPlaying: (isPlaying: boolean) => void;
  setProgress: (currentTime: number, duration: number, isBuffering: boolean) => void;
  setError: (error: string | null) => void;
  setOfflinePlayback: (isOffline: boolean) => void;
  reset: () => void;
}

const initialState = {
  queue: [] as Song[],
  index: 0,
  status: "idle" as PlayerStatus,
  isPlaying: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  error: null as string | null,
  isOfflinePlayback: false,
};

/** Single source of truth for the global music player UI. */
export const usePlayerStore = create<PlayerState>((set) => ({
  ...initialState,

  setQueue: (queue, index) => set({ queue, index }),
  setIndex: (index) => set({ index }),
  setStatus: (status) => set({ status }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setProgress: (currentTime, duration, isBuffering) =>
    set({ currentTime, duration, isBuffering, status: "ready" }),
  setError: (error) =>
    set(error ? { error, status: "error", isPlaying: false } : { error }),
  setOfflinePlayback: (isOfflinePlayback) => set({ isOfflinePlayback }),
  reset: () => set({ ...initialState }),
}));

export const selectCurrentSong = (state: PlayerState): Song | null => state.queue[state.index] ?? null;
