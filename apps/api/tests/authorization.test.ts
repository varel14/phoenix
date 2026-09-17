import { beforeAll, describe, expect, it } from "vitest";
import {
  createArtist,
  createUser,
  api,
  signIn,
  publishSong,
  truncateAll,
  uniqueEmail,
} from "./helpers.js";

describe("Authorization (roles + ownership)", () => {
  let normalUserEmail: string;
  let artistAId: string;
  let artistAEmail: string;
  let artistACookie: string;
  let artistBEmail: string;
  let artistBCookie: string;
  let songAId: string;

  beforeAll(async () => {
    await truncateAll();

    const normal = await createUser("Normal User", uniqueEmail("normal"));
    normalUserEmail = normal.email;

    const artistA = await createArtist("Artist A", uniqueEmail("artist-a"));
    artistAId = artistA.artistId;
    artistAEmail = artistA.email;
    artistACookie = artistA.cookie;
    songAId = await publishSong(artistA.cookie, artistA.artistId, "Song of A");

    const artistB = await createArtist("Artist B", uniqueEmail("artist-b"));
    artistBEmail = artistB.email;
    artistBCookie = artistB.cookie;
  });

  it("a normal user cannot publish artist content", async () => {
    const app = await api();
    const cookie = await signIn(normalUserEmail);

    const res = await app
      
      .post(`/api/v1/artists/${artistAId}/songs`)
      .set("Cookie", cookie)
      .send({ title: "Hack Song", audioUrl: "https://example.com/hack.mp3" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("a normal user cannot access another artist's stats", async () => {
    const app = await api();
    const cookie = await signIn(normalUserEmail);

    const res = await app.get(`/api/v1/artists/${artistAId}/stats`).set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("an artist cannot modify another artist's content", async () => {
    const app = await api();
    const cookie = await signIn(artistBEmail);

    const res = await app
      
      .patch(`/api/v1/artists/${artistAId}/songs/${songAId}`)
      .set("Cookie", cookie)
      .send({ title: "Hijacked Title" });

    expect(res.status).toBe(404);

    const removeRes = await app
      
      .delete(`/api/v1/artists/${artistAId}/songs/${songAId}`)
      .set("Cookie", cookie);
    expect(removeRes.status).toBe(404);
  });

  it("an artist cannot manage another artist's profile", async () => {
    const app = await api();
    const cookie = await signIn(artistBEmail);

    const res = await app
      
      .patch(`/api/v1/artists/${artistAId}`)
      .set("Cookie", cookie)
      .send({ name: "Renamed by B" });
    expect(res.status).toBe(404);
  });

  it("an artist can edit and delete their own content", async () => {
    const app = await api();

    const patchRes = await app
      
      .patch(`/api/v1/artists/${artistAId}/songs/${songAId}`)
      .set("Cookie", artistACookie)
      .send({ title: "Renamed by Owner" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.title).toBe("Renamed by Owner");

    const newSongId = await publishSong(artistACookie, artistAId, "Temporary Song");
    const deleteRes = await app
      
      .delete(`/api/v1/artists/${artistAId}/songs/${newSongId}`)
      .set("Cookie", artistACookie);
    expect(deleteRes.status).toBe(200);
  });

  it("unauthenticated users cannot publish content", async () => {
    const app = await api();
    const res = await app
      
      .post(`/api/v1/artists/${artistAId}/songs`)
      .send({ title: "Anon", audioUrl: "https://example.com/a.mp3" });
    expect(res.status).toBe(401);
  });
});
