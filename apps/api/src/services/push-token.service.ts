import { prisma } from "../config/prisma.js";
import type { DeletePushTokenBody, RegisterPushTokenBody } from "../validators/push.schema.js";

export const pushTokenService = {
  /**
   * Idempotent: the same device re-registers its token on every sign-in.
   * A token registered to another user (device was signed out) is re-owned.
   */
  async register(userId: string, body: RegisterPushTokenBody) {
    return prisma.pushToken.upsert({
      where: { token: body.token },
      create: {
        userId,
        token: body.token,
        platform: body.platform,
        deviceId: body.deviceId ?? null,
        appVersion: body.appVersion ?? null,
      },
      update: {
        userId,
        platform: body.platform,
        deviceId: body.deviceId ?? null,
        appVersion: body.appVersion ?? null,
      },
    });
  },

  /** Scoped to the owner so a user cannot unregister someone else's device. */
  async remove(userId: string, body: DeletePushTokenBody): Promise<void> {
    await prisma.pushToken.deleteMany({ where: { token: body.token, userId } });
  },
};
