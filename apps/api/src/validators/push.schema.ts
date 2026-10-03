import { z } from "zod";

export const registerPushTokenSchema = z.object({
  /** Expo push token (ExponentPushToken[...]). */
  token: z.string().min(1).max(4096),
  platform: z.enum(["ANDROID", "IOS", "WEB"]).default("ANDROID"),
  deviceId: z.string().max(255).optional(),
  appVersion: z.string().max(64).optional(),
});

export const deletePushTokenSchema = z.object({
  token: z.string().min(1).max(4096),
});

export type RegisterPushTokenBody = z.infer<typeof registerPushTokenSchema>;
export type DeletePushTokenBody = z.infer<typeof deletePushTokenSchema>;
