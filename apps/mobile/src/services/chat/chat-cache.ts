import { mmkv } from "@/services/storage/mmkv";
import type { ConversationSummary, Message } from "@/types/chat";

/**
 * Local chat persistence: messages are written to MMKV on send/receive and
 * conversation summaries on every full list refresh, so the chat opens
 * instantly and stays readable offline. Capped per conversation; server data
 * always wins over cached rows (merge is dedupe-by-id).
 */

const MESSAGES_KEY = (conversationId: string) =>
  `chat.messages.${conversationId}`;
const SUMMARIES_KEY = "chat.summaries";
/** Keep the most recent 200 messages per conversation. */
const MAX_CACHED_MESSAGES = 200;

export function loadCachedMessages(conversationId: string): Message[] {
  const raw = mmkv.getString(MESSAGES_KEY(conversationId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Merges server messages into the cache (dedupe by id, oldest first). */
export function saveMessages(
  conversationId: string,
  incoming: Message[],
): void {
  if (incoming.length === 0) return;
  const byId = new Map<string, Message>();
  for (const message of loadCachedMessages(conversationId))
    byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  const merged = [...byId.values()]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .slice(-MAX_CACHED_MESSAGES);
  mmkv.set(MESSAGES_KEY(conversationId), JSON.stringify(merged));
}

export function loadCachedSummaries(): ConversationSummary[] {
  const raw = mmkv.getString(SUMMARIES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ConversationSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSummaries(summaries: ConversationSummary[]): void {
  if (summaries.length === 0) return;
  mmkv.set(SUMMARIES_KEY, JSON.stringify(summaries));
}

/** Clears one conversation's cached thread. */
export function clearCachedMessages(conversationId: string): void {
  mmkv.remove(MESSAGES_KEY(conversationId));
}
