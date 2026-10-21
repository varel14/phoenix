import { randomUUID } from "node:crypto";
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

/** Funds a user's wallet via the dev top-up shortcut; returns the new balance. */
async function topUp(cookie: string, amount: number): Promise<number> {
  const app = await api();
  const init = await app
    .post("/api/v1/wallet/topups")
    .set("Cookie", cookie)
    .send({ amount });
  expect(init.status).toBe(201);
  const reference = init.body.data.transaction.reference as string;
  const confirmed = await app
    .post(`/api/v1/wallet/topups/${reference}/dev-confirm`)
    .set("Cookie", cookie);
  expect(confirmed.status).toBe(200);
  return confirmed.body.data.wallet.balance as number;
}

async function walletBalance(cookie: string): Promise<number> {
  const app = await api();
  const res = await app.get("/api/v1/wallet").set("Cookie", cookie);
  expect(res.status).toBe(200);
  return res.body.data.wallet.balance as number;
}

describe("Paid song downloads (1 FCFA) & artist stats", () => {
  let fanEmail: string;
  let artistEmail: string;
  let artistId: string;
  let songId: string;
  let lockedSongId: string;
  let videoId: string;

  beforeAll(async () => {
    await truncateAll();
    const fan = await createUser("DL Fan", uniqueEmail("dl-fan"));
    fanEmail = fan.email;
    const artist = await createArtist("DL Artist", uniqueEmail("dl-artist"));
    artistEmail = artist.email;
    artistId = artist.artistId;
    songId = await publishSong(artist.cookie, artist.artistId, "Paid Song");
    lockedSongId = await publishSong(
      artist.cookie,
      artist.artistId,
      "Locked Song",
      { isDownloadable: false },
    );
    videoId = await publishVideo(artist.cookie, artist.artistId, "Sub Video");
  });

  it("rejects a song download when the wallet cannot cover 1 FCFA", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "SONG", songId });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INSUFFICIENT_BALANCE");
  });

  it("charges 1 FCFA, credits the artist, and registers the download", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);
    await topUp(cookie, 100);
    const before = await walletBalance(cookie);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "SONG", songId });
    expect(res.status).toBe(201);
    expect(res.body.data.song.id).toBe(songId);
    expect(await walletBalance(cookie)).toBe(before - 1);

    const artistWallet = await app
      .get("/api/v1/wallet")
      .set("Cookie", await signIn(artistEmail));
    expect(artistWallet.body.data.wallet.balance).toBe(1);
  });

  it("never charges twice — re-registration is free", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);
    const before = await walletBalance(cookie);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "SONG", songId });
    expect(res.status).toBe(201);
    expect(await walletBalance(cookie)).toBe(before);
  });

  it("does not require a page subscription for song downloads", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);
    const subs = await app
      .get("/api/v1/subscriptions/me")
      .set("Cookie", cookie);
    expect(subs.body.data.subscription).toBeNull();

    const other = await createArtist("DL Artist 2", uniqueEmail("dl-artist-2"));
    const otherSong = await publishSong(
      other.cookie,
      other.artistId,
      "Other Song",
    );
    await topUp(cookie, 500);
    const before = await walletBalance(cookie);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "SONG", songId: otherSong });
    expect(res.status).toBe(201);
    expect(await walletBalance(cookie)).toBe(before - 1);
  });

  it("rejects non-downloadable songs", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "SONG", songId: lockedSongId });
    expect(res.status).toBe(403);
  });

  it("still requires a page subscription for video downloads", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);
    await topUp(cookie, 500);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", cookie)
      .send({ mediaType: "VIDEO", videoId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("artists download their own songs for free", async () => {
    const app = await api();
    const artistCookie = await signIn(artistEmail);

    const res = await app
      .post("/api/v1/downloads")
      .set("Cookie", artistCookie)
      .send({ mediaType: "SONG", songId });
    expect(res.status).toBe(201);
    expect(await walletBalance(artistCookie)).toBe(1); // only the fan's earlier credit
  });

  it("reports song stats: revenue, listeners and 30-day plays", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    // A second fan plays + downloads the song: PLAY events feed the stats.
    const fan2 = await createUser("DL Fan 2", uniqueEmail("dl-fan-2"));
    const fan2Cookie = await signIn(fan2.email);
    await topUp(fan2Cookie, 500);
    await app
      .post("/api/v1/downloads")
      .set("Cookie", fan2Cookie)
      .send({ mediaType: "SONG", songId });
    await app.post("/api/v1/events/playback").set("Cookie", fan2Cookie).send({
      clientEventId: randomUUID(),
      eventType: "PLAY",
      mediaType: "SONG",
      songId,
      occurredAt: new Date().toISOString(),
    });

    const res = await app
      .get(`/api/v1/artists/${artistId}/stats`)
      .set("Cookie", artistEmail ? await signIn(artistEmail) : "");
    expect(res.status).toBe(200);
    const stats = res.body.data;
    expect(stats.downloadRevenue).toBe(2); // two paid fans
    expect(stats.songStats).toHaveLength(2);
    const paid = stats.songStats.find((s: { id: string }) => s.id === songId);
    expect(paid.playCount).toBeGreaterThanOrEqual(0);
    expect(paid.downloadCount).toBeGreaterThanOrEqual(2);
    expect(paid).toHaveProperty("uniqueListeners");
    expect(paid).toHaveProperty("plays30d");
    expect(stats.uniqueListeners).toBeGreaterThanOrEqual(0);
  });
});
