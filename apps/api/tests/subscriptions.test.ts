import { beforeAll, describe, expect, it } from "vitest";
import {
  api,
  createArtist,
  createUser,
  publishSong,
  publishVideo,
  signIn,
  truncateAll,
  uniqueEmail,
} from "./helpers.js";

describe("Page subscriptions & download royalties", () => {
  let fanEmail: string;
  let artistEmail: string;
  let artistId: string;
  let songId: string;
  let videoId: string;
  let videoId2: string;

  beforeAll(async () => {
    await truncateAll();
    const fan = await createUser("Sub Fan", uniqueEmail("sub-fan"));
    fanEmail = fan.email;
    const artist = await createArtist("Sub Artist", uniqueEmail("sub-artist"));
    artistEmail = artist.email;
    artistId = artist.artistId;
    songId = await publishSong(artist.cookie, artist.artistId, "Sub Song");
    videoId = await publishVideo(artist.cookie, artist.artistId, "Sub Video");
    videoId2 = await publishVideo(
      artist.cookie,
      artist.artistId,
      "Sub Video 2",
    );
  });

  it("rejects video download registration without a page subscription", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "VIDEO", videoId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("subscribes to the artist page for 2 500 FCFA", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/subscriptions")
      .set("Cookie", cookie)
      .send({ artistId });
    expect(res.status).toBe(201);
    expect(res.body.data.subscription.monthlyAmount).toBe(2500);
    expect(res.body.data.subscription.status).toBe("ACTIVE");
    expect(res.body.data.transaction.amount).toBe(2500);
    expect(res.body.data.transaction.status).toBe("SUCCESS");
    expect(res.body.data.transaction.reference).toMatch(/^CHY-ABO/);

    const periodEnd = new Date(res.body.data.subscription.currentPeriodEnd);
    const expected = new Date();
    expected.setUTCMonth(expected.getUTCMonth() + 1);
    expect(periodEnd.getTime()).toBeGreaterThan(
      Date.now() + 28 * 24 * 3600 * 1000,
    );
    expect(periodEnd.getTime()).toBeLessThanOrEqual(expected.getTime() + 1000);
  });

  it("registers a video download after subscribing and accrues the 1 FCFA royalty", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "VIDEO", videoId });
    expect(res.status).toBe(201);

    const status = await app
      .get("/api/v1/subscriptions/me")
      .set("Cookie", cookie);
    expect(status.status).toBe(200);
    expect(status.body.data.pricing.monthlyPrice).toBe(2500);
    expect(status.body.data.pricing.downloadRoyalty).toBe(1);
    expect(status.body.data.usage.downloadedTracks).toBe(1);
    expect(status.body.data.usage.royaltyDueThisMonth).toBe(1);
    expect(status.body.data.usage.royaltyTotal).toBe(1);
    expect(status.body.data.history).toHaveLength(1);
    expect(status.body.data.history[0].amount).toBe(1);
  });

  it("does not double-charge the royalty on idempotent re-registration", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "VIDEO", videoId });
    expect(res.status).toBe(201);

    const status = await app
      .get("/api/v1/subscriptions/me")
      .set("Cookie", cookie);
    expect(status.body.data.usage.royaltyTotal).toBe(1);
  });

  it("registers a second video download under the same subscription", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "VIDEO", videoId: videoId2 });
    expect(res.status).toBe(201);

    const status = await app
      .get("/api/v1/subscriptions/me")
      .set("Cookie", cookie);
    expect(status.body.data.usage.downloadedTracks).toBe(2);
    expect(status.body.data.usage.royaltyDueThisMonth).toBe(2);
  });

  it("reports the artist earnings (1 FCFA per kept download)", async () => {
    const app = await api();
    const cookie = await signIn(artistEmail);

    const res = await app
      .get("/api/v1/subscriptions/royalties/earnings")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.artist.id).toBe(artistId);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.subscribers).toBe(1);
    expect(res.body.data.months[0].amount).toBe(2);
  });

  it("lists the payer royalty history", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .get("/api/v1/subscriptions/royalties/mine")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.months[0].downloads).toBe(2);
  });

  it("cancels the subscription and blocks video downloads again", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .delete("/api/v1/subscriptions/me")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.cancelled).toBe(1);

    const blocked = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "VIDEO", videoId });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("re-activates a cancelled subscription on subscribe", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/subscriptions")
      .set("Cookie", cookie)
      .send({ artistId });
    expect(res.status).toBe(201);
    expect(res.body.data.subscription.status).toBe("ACTIVE");

    const unblocked = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "VIDEO", videoId });
    expect(unblocked.status).toBe(201);
  });

  it("rejects subscribing to an unknown artist", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/subscriptions")
      .set("Cookie", cookie)
      .send({ artistId: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(404);
  });

  it("requires auth", async () => {
    const app = await api();
    const res = await app.get("/api/v1/subscriptions/me");
    expect(res.status).toBe(401);
  });
});
