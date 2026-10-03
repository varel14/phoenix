import { useEffect } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationsApi, callsApi } from "@/services/api/chat-api";
import { getSocket } from "@/services/realtime/socket";
import { queryKeys } from "@/constants/query-keys";
import type { Message, MessagePayload, ReadPayload } from "@/types/chat";

export function useConversations(params: { search?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.conversations(params),
    queryFn: () => conversationsApi.list({ limit: 50, ...params }),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: () => conversationsApi.getById(id),
  });
}

export interface MessagesPage {
  messages: Message[];
  page: number;
  hasMore: boolean;
}

const MESSAGES_QUERY_KEY = "messages";

/** Newest-first infinite pagination; the chat screen reverses for display. */
export function useInfiniteMessages(conversationId: string) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: [MESSAGES_QUERY_KEY, conversationId, "infinite"],
    queryFn: async ({ pageParam }) => {
      const result = await conversationsApi.listMessages(conversationId, {
        page: pageParam,
        limit: 30,
      });
      return {
        messages: result.data,
        page: result.pagination.page,
        hasMore: result.pagination.page < result.pagination.totalPages,
      } satisfies MessagesPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  const socket = getSocket();
  useEffect(() => {
    const onNewMessage = (payload: MessagePayload) => {
      if (payload.conversationId !== conversationId) return;
      queryClient.setQueryData<{ pages: MessagesPage[]; pageParams: number[] }>(
        [MESSAGES_QUERY_KEY, conversationId, "infinite"],
        (old) => {
          if (!old || old.pages.length === 0) return old;
          const exists = old.pages.some((page) => page.messages.some((m) => m.id === payload.message.id));
          if (exists) return old;
          const [first, ...rest] = old.pages;
          const pages = [{ ...first, messages: [payload.message, ...first.messages] }, ...rest];
          return { ...old, pages };
        },
      );
    };
    socket?.on("message:new", onNewMessage);
    return () => {
      socket?.off("message:new", onNewMessage);
    };
  }, [socket, conversationId, queryClient]);

  return query;
}

export function useReadReceipts(onRead: (payload: ReadPayload) => void) {
  const socket = getSocket();
  useEffect(() => {
    socket?.on("message:read", onRead);
    return () => {
      socket?.off("message:read", onRead);
    };
  }, [socket, onRead]);
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => conversationsApi.markRead(conversationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: Parameters<typeof conversationsApi.sendMessage>[1];
    }) => conversationsApi.sendMessage(conversationId, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [MESSAGES_QUERY_KEY, variables.conversationId, "infinite"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useCallHistory() {
  return useQuery({
    queryKey: queryKeys.callHistory(),
    queryFn: () => callsApi.list({ limit: 50 }),
  });
}
