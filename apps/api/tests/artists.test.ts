import { beforeAll, describe, expect, it } from "vitest";
import {
  createArtist,
  createUser,
  api,
  signIn,
  publishSong,
  publishVideo,
  truncateAll,
  uniqueEmail,
} from "./helpers.js";

describe("Artist follows and stats", () => {
  let fanEmail: string;
  let artistEmail: string;
  let artistId: string;
  let songId: string;
  let videoId: string;

  beforeAll(async () => {
    await truncateAll();
    const fan = await createUser("Fan", uniqueEmail("fan"));
    fanEmail = fan.email;

    const artist = await createArtist("Followed Artist", uniqueEmail("followed"));
    artistEmail = artist.email;
    artistId = artist.artistId;
    songId = await publishSong(artist.cookie, artistId, "Stats Song");
    videoId = await publishVideo(artist.cookie, artistId, "Stats Video");
  });

  it("follows an artist", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app.post(`/api/v1/artists/${artistId}/follow`).set("Cookie", cookie);
    expect(res.status).toBe(201);

    const detail = await app.get(`/api/v1/artists/${artistId}`).set("Cookie", cookie);
    expect(detail.body.data.isFollowing).toBe(true);
  });

  it("prevents duplicate follows", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app.post(`/api/v1/artists/${artistId}/follow`).set("Cookie", cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("prevents following your own artist profile", async () => {
    const app = await api();
    const cookie = await signIn(artistEmail);

    const res = await app.post(`/api/v1/artists/${artistId}/follow`).set("Cookie", cookie);
    expect(res.status).toBe(400);
  });

  it("unfollows an artist", async () => {
    const app = await api();
    const cookie = await signIn(fanEmail);

    const res = await app.delete(`/api/v1/artists/${artistId}/follow`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    const repeat = await app
      
      .delete(`/api/v1/artists/${artistId}/follow`)
      .set("Cookie", cookie);
    expect(repeat.status).toBe(404);
  });

  it("reports artist statistics to the owner", async () => {
    const app = await api();
    const fanCookie = await signIn(fanEmail);
    const artistCookie = await signIn(artistEmail);

    // Generate activity: 2 plays, 1 view, 1 download
    await app
      
      .post("/api/v1/events/playback")
      .set("Cookie", fanCookie)
      .send({ eventType: "PLAY", mediaType: "SONG", songId, clientEventId: "99991111-1111-4111-8111-111111111111", occurredAt: "2026-09-16T08:00:00Z" });
    await app
      
      .post("/api/v1/events/playback")
      .set("Cookie", fanCookie)
      .send({ eventType: "PLAY", mediaType: "SONG", songId, clientEventId: "99992222-2222-4222-8222-222222222222", occurredAt: "2026-09-16T08:01:00Z" });
    await app
      
      .post("/api/v1/events/playback")
      .set("Cookie", fanCookie)
      .send({ eventType: "VIEW", mediaType: "VIDEO", videoId, clientEventId: "99993333-3333-4333-8333-333333333333", occurredAt: "2026-09-16T08:02:00Z" });
    await app
      
      .post("/api/v1/events/playback")
      .set("Cookie", fanCookie)
      .send({ eventType: "DOWNLOAD", mediaType: "SONG", songId, clientEventId: "99994444-4444-4444-8444-444444444444", occurredAt: "2026-09-16T08:03:00Z" });

    // Fan follows again so the subscriber count reflects in stats
    await app.post(`/api/v1/artists/${artistId}/follow`).set("Cookie", fanCookie);

    const res = await app.get(`/api/v1/artists/${artistId}/stats`).set("Cookie", artistCookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ plays: 2, views: 1, downloads: 1, subscribers: 1 });
  });
});
