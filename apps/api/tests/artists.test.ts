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

    // Generate activity: 2 plays, 1 view, 1 download — dated yesterday so the
    // events always land inside the 30-day trend window.
    const occurredAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const yesterday = occurredAt.slice(0, 10);
    await app

      .post("/api/v1/events/playback")
      .set("Cookie", fanCookie)
      .send({ eventType: "PLAY", mediaType: "SONG", songId, clientEventId: "99991111-1111-4111-8111-111111111111", occurredAt });
    await app

      .post("/api/v1/events/playback")
      .set("Cookie", fanCookie)
      .send({ eventType: "PLAY", mediaType: "SONG", songId, clientEventId: "99992222-2222-4222-8222-222222222222", occurredAt });
    await app

      .post("/api/v1/events/playback")
      .set("Cookie", fanCookie)
      .send({ eventType: "VIEW", mediaType: "VIDEO", videoId, clientEventId: "99993333-3333-4333-8333-333333333333", occurredAt });
    await app

      .post("/api/v1/events/playback")
      .set("Cookie", fanCookie)
      .send({ eventType: "DOWNLOAD", mediaType: "SONG", songId, clientEventId: "99994444-4444-4444-8444-444444444444", occurredAt });

    // Fan follows again so the subscriber count reflects in stats
    await app.post(`/api/v1/artists/${artistId}/follow`).set("Cookie", fanCookie);

    const res = await app.get(`/api/v1/artists/${artistId}/stats`).set("Cookie", artistCookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ plays: 2, views: 1, downloads: 1, subscribers: 1, favorites: 0, songs: 1, videos: 1 });
    expect(res.body.data.topSongs).toEqual([
      { id: songId, title: "Stats Song", playCount: 2, downloadCount: 1, favorites: 0 },
    ]);
    expect(res.body.data.topVideos).toEqual([{ id: videoId, title: "Stats Video", viewCount: 1, downloadCount: 0 }]);
    expect(res.body.data.daily).toHaveLength(30);
    expect(res.body.data.daily.find((day: { date: string }) => day.date === yesterday)).toEqual({
      date: yesterday,
      plays: 2,
      views: 1,
    });
  });

  it("counts favorites and ranks top songs by plays", async () => {
    const app = await api();
    const fanCookie = await signIn(fanEmail);
    const artistCookie = await signIn(artistEmail);

    const secondSongId = await publishSong(artistCookie, artistId, "Second Stats Song");
    await app.post("/api/v1/favorites").set("Cookie", fanCookie).send({ mediaType: "SONG", songId });
    await app.post("/api/v1/favorites").set("Cookie", fanCookie).send({ mediaType: "SONG", songId: secondSongId });

    // Out-play the first song so the ranking has to reorder.
    for (let i = 0; i < 5; i += 1) {
      await app
        .post("/api/v1/events/playback")
        .set("Cookie", fanCookie)
        .send({
          eventType: "PLAY",
          mediaType: "SONG",
          songId: secondSongId,
          clientEventId: `9999555${i}-5555-4555-8555-55555555555${i}`,
          occurredAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        });
    }

    const res = await app.get(`/api/v1/artists/${artistId}/stats`).set("Cookie", artistCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.favorites).toBe(2);
    expect(res.body.data.songs).toBe(2);
    expect(res.body.data.topSongs).toHaveLength(2);
    expect(res.body.data.topSongs[0]).toMatchObject({ id: secondSongId, playCount: 5, favorites: 1 });
    expect(res.body.data.topSongs[1]).toMatchObject({ id: songId, playCount: 2, favorites: 1 });
  });
});
