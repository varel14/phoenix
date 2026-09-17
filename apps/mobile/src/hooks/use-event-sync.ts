import { useEffect } from "react";
import { useNetworkState } from "expo-network";
import { AppState } from "react-native";
import { flushQueue } from "@/services/events/event-queue";

/**
 * Watches connectivity and app foreground transitions, flushing the offline
 * event queue whenever we are online again.
 */
export function useEventSync() {
  const networkState = useNetworkState();

  useEffect(() => {
    const isConnected = networkState?.isConnected ?? false;
    if (isConnected) {
      void flushQueue();
    }
  }, [networkState?.isConnected]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void flushQueue();
      }
    });
    return () => subscription.remove();
  }, []);
}
