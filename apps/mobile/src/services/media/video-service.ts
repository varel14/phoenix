import { createVideoPlayer, type VideoPlayer, type VideoSource } from "expo-video";

/**
 * Multi-player video architecture.
 *
 * Phoenix requires up to THREE simultaneous video players (e.g. a main
 * player plus two muted previews). expo-video supports independent Player
 * instances; this module adds a small registry that:
 *   - caps the number of live players (MAX_PLAYERS = 3)
 *   - releases the least-recently-used player beyond the cap
 *   - pauses others only when a screen asks for "exclusive" playback
 */

export const MAX_PLAYERS = 3;

interface Entry {
  player: VideoPlayer;
  lastUsedAt: number;
}

const registry = new Map<string, Entry>();

function evictBeyondCap() {
  if (registry.size <= MAX_PLAYERS) return;
  const entries = [...registry.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
  const toEvict = registry.size - MAX_PLAYERS;
  for (let i = 0; i < toEvict; i += 1) {
    const [key, entry] = entries[i]!;
    entry.player.release();
    registry.delete(key);
  }
}

/**
 * Creates (or reuses) a video player registered under a screen-scoped key.
 * The returned player must be released via releasePlayer when its screen
 * unmounts (expo-video's useVideoPlayer does this automatically; this
 * manual path exists for the concurrent-player registry).
 */
export function acquirePlayer(key: string, source: VideoSource): VideoPlayer {
  const existing = registry.get(key);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing.player;
  }

  const player = createVideoPlayer(source);
  registry.set(key, { player, lastUsedAt: Date.now() });
  evictBeyondCap();
  return player;
}

export function releasePlayer(key: string) {
  const entry = registry.get(key);
  if (entry) {
    entry.player.release();
    registry.delete(key);
  }
}

/** For "only one video plays at once" surfaces (feeds, list rows). */
export function pauseOthers(keepKey: string) {
  for (const [key, entry] of registry.entries()) {
    if (key !== keepKey) {
      entry.player.pause();
    }
  }
}

export function activePlayerCount(): number {
  return registry.size;
}
