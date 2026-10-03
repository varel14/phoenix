import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const expo = new Expo(env.EXPO_PUSH_ACCESS_TOKEN ? { accessToken: env.EXPO_PUSH_ACCESS_TOKEN } : {});

export interface PushPayload {
  title: string;
  body: string;
  /** Deep-link data read by the app when the notification is tapped. */
  data?: Record<string, unknown>;
  /** Android notification channel: "calls" (ringing) or "messages". */
  channelId?: string;
}

/**
 * Sends an Expo push to every registered device of the given users.
 * Best-effort by contract: failures are logged, never thrown, so callers in
 * the realtime pipeline cannot break because a push did not go out.
 */
async function sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });

    const messages: ExpoPushMessage[] = tokens
      .map((t) => t.token)
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: "default" as const,
        ...(payload.channelId ? { channelId: payload.channelId } : {}),
      }));

    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      await pruneDeadTokens(chunk, tickets);
    }
  } catch (error) {
    console.warn("[push] delivery failed:", (error as Error).message);
  }
}

/** Deletes tokens that Expo reports as no longer registered (app uninstalled). */
async function pruneDeadTokens(chunk: ExpoPushMessage[], tickets: unknown[]): Promise<void> {
  const dead: string[] = [];
  for (let index = 0; index < tickets.length; index += 1) {
    const ticket = tickets[index] as { status?: string; details?: { error?: string } } | undefined;
    const to = chunk[index]?.to as string | undefined;
    if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered" && to) {
      dead.push(to);
    }
  }

  if (dead.length > 0) {
    await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}

export const pushService = { sendToUsers };
