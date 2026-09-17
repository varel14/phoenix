import { beforeAll, describe, expect, it } from "vitest";
import {
  createArtist,
  createUser,
  api,
  publishSong,
  publishVideo,
  signIn,
  truncateAll,
  uniqueEmail,
} from "./helpers.js";

describe("Favorites", () => {
  let userEmail: string;
  let songId: string;
  let videoId: string;

  beforeAll(async () => {
    await truncateAll();
    const user = await createUser("Fav User", uniqueEmail("fav"));
    userEmail = user.email;
    const artist = await createArtist("Fav Artist", uniqueEmail("fav-artist"));
    songId = await publishSong(artist.cookie, artist.artistId, "Fav Song");
    videoId = await publishVideo(artist.cookie, artist.artistId, "Fav Video");
  });

  it("creates a song favorite", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    const res = await app.post(`/api/v1/songs/${songId}/favorite`).set("Cookie", cookie);
    expect(res.status).toBe(201);
  });

  it("rejects duplicate favorites", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    const res = await app.post(`/api/v1/songs/${songId}/favorite`).set("Cookie", cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("lists favorites and filters by media type", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    await app.post(`/api/v1/videos/${videoId}/favorite`).set("Cookie", cookie);

    const all = await app.get("/api/v1/favorites").set("Cookie", cookie);
    expect(all.status).toBe(200);
    expect(all.body.pagination.total).toBe(2);

    const songsOnly = await app
      
      .get("/api/v1/favorites?mediaType=SONG")
      .set("Cookie", cookie);
    expect(songsOnly.body.pagination.total).toBe(1);
    expect(songsOnly.body.data[0].song.id).toBe(songId);
  });

  it("removes a favorite via the song endpoint", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    const res = await app.delete(`/api/v1/songs/${songId}/favorite`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    const repeat = await app.delete(`/api/v1/songs/${songId}/favorite`).set("Cookie", cookie);
    expect(repeat.status).toBe(404);
  });

  it("removes a favorite by record id via /favorites/:id", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    const list = await app.get("/api/v1/favorites?mediaType=VIDEO").set("Cookie", cookie);
    const favoriteId = list.body.data[0].id as string;

    const res = await app.delete(`/api/v1/favorites/${favoriteId}`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    const after = await app.get("/api/v1/favorites").set("Cookie", cookie);
    expect(after.body.pagination.total).toBe(0);
  });
});
