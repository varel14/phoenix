import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { api, createUser, truncateAll, uniqueEmail } from "./helpers.js";

describe("Push notifications", () => {
  describe("token registration", () => {
    it("requires authentication", async () => {
      const app = await api();
      const res = await app
        .post("/api/v1/push/tokens")
        .send({ token: "ExponentPushToken[test]" });

      expect(res.status).toBe(401);
    });

    it("rejects a missing token", async () => {
      await truncateAll();
      const user = await createUser("Push User", uniqueEmail("push"));
      const app = await api();

      const res = await app.post("/api/v1/push/tokens").set("Cookie", user.cookie).send({});

      expect(res.status).toBe(400);
    });

    it("registers a token and re-owns it when another user re-registers", async () => {
      await truncateAll();
      const first = await createUser("First Owner", uniqueEmail("push-first"));
      const second = await createUser("Second Owner", uniqueEmail("push-second"));
      const app = await api();
      const token = `ExponentPushToken[${Date.now()}]`;

      const created = await app
        .post("/api/v1/push/tokens")
        .set("Cookie", first.cookie)
        .send({ token, platform: "ANDROID" });
      expect(created.status).toBe(201);
      expect(created.body.data.userId).toBe(first.userId);

      const reRegistered = await app
        .post("/api/v1/push/tokens")
        .set("Cookie", second.cookie)
        .send({ token, platform: "ANDROID" });
      expect(reRegistered.status).toBe(201);

      const rows = await prisma.pushToken.findMany({ where: { token } });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.userId).toBe(second.userId);
    });

    it("deletes only the caller's own token", async () => {
      await truncateAll();
      const owner = await createUser("Token Owner", uniqueEmail("push-owner"));
      const stranger = await createUser("Token Stranger", uniqueEmail("push-stranger"));
      const app = await api();
      const token = `ExponentPushToken[${Date.now()}]`;

      await app.post("/api/v1/push/tokens").set("Cookie", owner.cookie).send({ token });

      // A stranger cannot unregister someone else's device.
      const forbidden = await app
        .delete("/api/v1/push/tokens")
        .set("Cookie", stranger.cookie)
        .send({ token });
      expect(forbidden.status).toBe(200);
      expect(await prisma.pushToken.count({ where: { token } })).toBe(1);

      const res = await app.delete("/api/v1/push/tokens").set("Cookie", owner.cookie).send({ token });
      expect(res.status).toBe(200);
      expect(await prisma.pushToken.count({ where: { token } })).toBe(0);
    });
  });

  describe("GET /calls/ice-servers", () => {
    it("requires authentication", async () => {
      const app = await api();
      const res = await app.get("/api/v1/calls/ice-servers");
      expect(res.status).toBe(401);
    });

    it("returns at least one STUN server", async () => {
      const user = await createUser("Ice User", uniqueEmail("ice"));
      const app = await api();

      const res = await app.get("/api/v1/calls/ice-servers").set("Cookie", user.cookie);

      expect(res.status).toBe(200);
      const { iceServers } = res.body.data as { iceServers: { urls: string | string[] }[] };
      expect(Array.isArray(iceServers)).toBe(true);
      expect(iceServers.length).toBeGreaterThan(0);
      const urls = iceServers.flatMap((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]));
      expect(urls.some((url) => url.startsWith("stun:"))).toBe(true);
    });
  });
});
