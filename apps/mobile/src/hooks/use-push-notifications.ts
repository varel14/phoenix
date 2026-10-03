import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useAuthStore } from "@/stores/auth-store";
import { registerPushNotifications, unregisterPushNotifications } from "@/services/push/push-service";

type PushData = { kind?: string; conversationId?: string };

function routeFromNotification(data: unknown): void {
  // Cold starts fire before auth restore finishes; navigating then would
  // bounce off the auth gate — skip and let the user open it manually.
  if (!useAuthStore.getState().user) return;
  const payload = data as PushData | undefined;
  if (payload?.kind === "message" && payload.conversationId) {
    router.push(`/chat/${payload.conversationId}`);
  } else if (payload?.kind === "call") {
    router.push("/(tabs)/messages");
  }
}

/**
 * Registers the device for push while signed in and removes the token on
 * sign-out; notification taps deep-link into the conversation list or chat.
 */
export function usePushNotifications() {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user) {
      void unregisterPushNotifications();
      return;
    }
    void registerPushNotifications();
    return () => void unregisterPushNotifications();
  }, [user]);

  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) routeFromNotification(response.notification.request.content.data);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromNotification(response.notification.request.content.data);
    });
    return () => subscription.remove();
  }, []);
}
