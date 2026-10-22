import { apiFetch, getPaginated } from "./api-client";
import type {
  Call,
  Conversation,
  ConversationSummary,
  Message,
  MessagePayload,
  ReadPayload,
} from "@/types/chat";

export const conversationsApi = {
  async searchUsers(search: string) {
    const result = await apiFetch<{
      data: Array<{ id: string; name: string; image: string | null }>;
    }>(`/api/v1/conversations/users?search=${encodeURIComponent(search)}`);
    return result.data;
  },

  async list(params: { page?: number; limit?: number; search?: string } = {}) {
    const result = await getPaginated<ConversationSummary>(
      "/api/v1/conversations",
      params,
    );
    return result;
  },

  async create(
    recipientId: string,
    options?: {
      /** Keep the conversation as a draft ("brouillon") — no message. */
      draft?: boolean;
      /** First message, sent atomically with the conversation creation. */
      message?: {
        type?: "TEXT" | "VOICE" | "IMAGE" | "VIDEO" | "FILE";
        content?: string;
      };
    },
  ) {
    const result = await apiFetch<{ data: Conversation }>(
      "/api/v1/conversations",
      {
        method: "POST",
        body: {
          recipientId,
          ...(options?.draft ? { draft: true } : {}),
          ...(options?.message ? { message: options.message } : {}),
        },
      },
    );
    return result.data;
  },

  async getById(id: string) {
    const result = await apiFetch<{ data: Conversation }>(
      `/api/v1/conversations/${id}`,
    );
    return result.data;
  },

  async listMessages(
    id: string,
    params: { page?: number; limit?: number } = {},
  ) {
    return getPaginated<Message>(
      `/api/v1/conversations/${id}/messages`,
      params,
    );
  },

  /** Typo-tolerant message search inside one conversation (pg_trgm, server-side). */
  async searchMessages(id: string, q: string) {
    const result = await apiFetch<{ data: Message[] }>(
      `/api/v1/conversations/${id}/messages/search?q=${encodeURIComponent(q)}`,
    );
    return result.data;
  },

  async sendMessage(
    id: string,
    body: {
      type?: "TEXT" | "VOICE" | "IMAGE" | "VIDEO" | "FILE";
      content?: string;
      attachment?: {
        url: string;
        storageKey: string;
        mimeType?: string;
        fileSizeBytes?: number;
        durationSec?: number;
        name?: string;
      };
    },
  ) {
    const result = await apiFetch<{ data: Message }>(
      `/api/v1/conversations/${id}/messages`,
      {
        method: "POST",
        body,
      },
    );
    return result.data;
  },

  async markRead(id: string) {
    const result = await apiFetch<{ data: { lastReadAt: string } }>(
      `/api/v1/conversations/${id}/read`,
      {
        method: "POST",
      },
    );
    return result.data;
  },
};

export const callsApi = {
  async list(params: { page?: number; limit?: number } = {}) {
    return getPaginated<Call>("/api/v1/calls", params);
  },
};

export type { MessagePayload, ReadPayload };
