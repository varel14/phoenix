import { storage as AsyncStorage } from "@/services/storage/mmkv";
import { eventsApi, type QueuedEvent } from "@/services/api/library-api";
import { useAuthStore } from "@/stores/auth-store";
import { uuid } from "@/utils/uuid";

/**
 * Offline event queue. Events (PLAY / VIEW / DOWNLOAD) are persisted locally
 * and synchronized when connectivity returns. Every event carries a
 * client-generated UUID (clientEventId); the server deduplicates on it, so
 * retries / restarts / duplicate syncs never double-count.
 */

const QUEUE_KEY = "phoenix.event_queue";
const MAX_QUEUE_SIZE = 2000;

let flushInFlight = false;

export async function readQueue(): Promise<QueuedEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedEvent[]): Promise<void> {
  const trimmed = queue.slice(-MAX_QUEUE_SIZE);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
}

export interface TrackEventInput {
  eventType: QueuedEvent["eventType"];
  mediaType: QueuedEvent["mediaType"];
  songId?: string;
  videoId?: string;
}

/** Records an event: queue always, then attempt an immediate flush. */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  if (!useAuthStore.getState().user) return; // anonymous usage is not tracked

  const event: QueuedEvent = {
    clientEventId: uuid(),
    eventType: input.eventType,
    mediaType: input.mediaType,
    songId: input.songId,
    videoId: input.videoId,
    occurredAt: new Date().toISOString(),
  };

  const queue = await readQueue();
  queue.push(event);
  await writeQueue(queue);

  void flushQueue();
}

/**
 * Synchronizes the queue with the server. Idempotency is guaranteed by the
 * server's unique clientEventId constraint — replaying the same batch is safe.
 */
export async function flushQueue(): Promise<{ flushed: number } | null> {
  if (flushInFlight) return null;
  if (!useAuthStore.getState().user) return null;

  flushInFlight = true;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return { flushed: 0 };

    const CHUNK = 100;
    const syncedIds = new Set<string>();

    for (let i = 0; i < queue.length; i += CHUNK) {
      const chunk = queue.slice(i, i + CHUNK);
      try {
        const result = await eventsApi.syncBatch(chunk);
        // accepted AND duplicates are both "synced" — the server knows them.
        for (const event of chunk) syncedIds.add(event.clientEventId);
        void result;
      } catch (error) {
        if (error instanceof Error && "status" in error && (error as { status?: number }).status === 401) {
          break; // signed out — keep queue for the next session
        }
        // Network error: stop and keep the remaining queue for later.
        break;
      }
    }

    const remaining = queue.filter((event) => !syncedIds.has(event.clientEventId));
    await writeQueue(remaining);
    return { flushed: syncedIds.size };
  } finally {
    flushInFlight = false;
  }
}
