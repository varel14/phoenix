import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  connectRealtime,
  disconnectRealtime,
  getSocket,
} from "@/services/realtime/socket";
import { webrtcService } from "@/services/calls/webrtc.service";
import { useAuthStore } from "@/stores/auth-store";
import type { MessagePayload } from "@/types/chat";

/**
 * Connects the Socket.IO session while signed in:
 * - chat deliveries refresh the conversation list cache;
 * - call + WebRTC signaling is bound to the socket;
 * - everything disconnects on sign-out.
 */
export function useRealtime() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      disconnectRealtime();
      return;
    }

    let cancelled = false;
    void (async () => {
      const socket = await connectRealtime();
      if (cancelled || !socket) return;

      // socket.io-client keeps listeners across automatic reconnections.
      webrtcService.bind();

      const onMessageReceived = (payload: MessagePayload) => {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        if (payload.conversationId) {
          void queryClient.invalidateQueries({
            queryKey: ["messages", payload.conversationId, "infinite"],
          });
        }
      };

      const onFollowRequest = () => {
        void queryClient.invalidateQueries({ queryKey: ["follow-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      };
      const onFollowAccepted = (payload: { userId?: string }) => {
        void queryClient.invalidateQueries({ queryKey: ["follow-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["contacts"] });
        if (payload?.userId) {
          void queryClient.invalidateQueries({
            queryKey: ["follow-state", payload.userId],
          });
        }
      };

      socket.on("message:received", onMessageReceived);
      socket.on("follow:request", onFollowRequest);
      socket.on("follow:accepted", onFollowAccepted);
    })();

    return () => {
      cancelled = true;
      const socket = getSocket();
      socket?.off("message:received");
      socket?.off("follow:request");
      socket?.off("follow:accepted");
      disconnectRealtime();
    };
  }, [user, queryClient]);
}
