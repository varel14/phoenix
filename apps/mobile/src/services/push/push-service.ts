import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiFetch } from "../api/api-client";

// Foreground behavior: banner + list entry with sound, for both channels.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const CALLS_CHANNEL = "calls";
const MESSAGES_CHANNEL = "messages";

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CALLS_CHANNEL, {
    name: "Appels",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
  });
  await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL, {
    name: "Messages",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

let registeredToken: string | null = null;

/**
 * Registers with Expo push and hands the token to the API so the server can
 * reach this device while the app is backgrounded or closed.
 * Requires EXPO_PUBLIC_EAS_PROJECT_ID (push tokens are project-scoped);
 * silently skips when it is unset (e.g. plain `expo start` without EAS).
 */
export async function registerPushNotifications(): Promise<void> {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId || registeredToken) return;

  try {
    const settings = await Notifications.requestPermissionsAsync();
    if (!settings.granted) return;

    await ensureAndroidChannels();

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await apiFetch("/api/v1/push/tokens", {
      method: "POST",
      body: {
        token,
        platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
        deviceId: Constants.installationId,
        appVersion: Constants.expoConfig?.version,
      },
    });
    registeredToken = token;
  } catch (error) {
    console.warn("Push registration failed:", (error as Error).message);
  }
}

/** Best-effort: called on sign-out so the server stops ringing this device. */
export async function unregisterPushNotifications(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await apiFetch("/api/v1/push/tokens", { method: "DELETE", body: { token } });
  } catch {
    // Server-side cleanup is best-effort; the token is dropped locally regardless.
  }
}
