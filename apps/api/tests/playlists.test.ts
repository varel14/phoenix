import { beforeAll, describe, expect, it } from "vitest";
import {
  createArtist,
  createUser,
  api,
  publishSong,
  signIn,
  truncateAll,
  uniqueEmail,
} from "./helpers.js";

describe("Playlists", () => {
  let userEmail: string;
  let otherUserEmail: string;
  let songId: string;

  beforeAll(async () => {
    await truncateAll();
    const user = await createUser("Playlist User", uniqueEmail("pl-user"));
    userEmail = user.email;
    const other = await createUser("Other User", uniqueEmail("pl-other"));
    otherUserEmail = other.email;
    const artist = await createArtist("Playlist Artist", uniqueEmail("pl-artist"));
    songId = await publishSong(artist.cookie, artist.artistId, "Playlist Song");
  });

  it("creates a playlist", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    const res = await app
      
      .post("/api/v1/playlists")
      .set("Cookie", cookie)
      .send({ name: "My Mix", isPublic: false });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("My Mix");
    expect(res.body.data._count.items).toBe(0);
  });

  it("adds and lists items", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    const created = await app.get("/api/v1/playlists").set("Cookie", cookie);
    const playlistId = created.body.data[0].id as string;

    const add = await app
      
      .post(`/api/v1/playlists/${playlistId}/items`)
      .set("Cookie", cookie)
      .send({ songId });
    expect(add.status).toBe(201);
    expect(add.body.data.song.id).toBe(songId);

    const items = await app
      
      .get(`/api/v1/playlists/${playlistId}/items`)
      .set("Cookie", cookie);
    expect(items.body.data).toHaveLength(1);
    expect(items.body.data[0].position).toBe(0);
  });

  it("rejects duplicate playlist items", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);
    const playlistId = (
      await app.get("/api/v1/playlists").set("Cookie", cookie)
    ).body.data[0].id as string;

    const res = await app
      
      .post(`/api/v1/playlists/${playlistId}/items`)
      .set("Cookie", cookie)
      .send({ songId });
    expect(res.status).toBe(409);
  });

  it("lets a user modify their own playlist", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);
    const playlistId = (
      await app.get("/api/v1/playlists").set("Cookie", cookie)
    ).body.data[0].id as string;

    const res = await app
      
      .patch(`/api/v1/playlists/${playlistId}`)
      .set("Cookie", cookie)
      .send({ name: "Renamed Mix" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed Mix");
  });

  it("prevents a user from modifying another user's private playlist", async () => {
    const app = await api();
    const ownerCookie = await signIn(userEmail);
    const playlistId = (
      await app.get("/api/v1/playlists").set("Cookie", ownerCookie)
    ).body.data[0].id as string;

    const otherCookie = await signIn(otherUserEmail);

    // Private playlist of another user is invisible (404, not 403 — no leak)
    const get = await app.get(`/api/v1/playlists/${playlistId}`).set("Cookie", otherCookie);
    expect(get.status).toBe(404);

    const patch = await app
      
      .patch(`/api/v1/playlists/${playlistId}`)
      .set("Cookie", otherCookie)
      .send({ name: "Stolen" });
    expect(patch.status).toBe(404);

    const remove = await app
      
      .delete(`/api/v1/playlists/${playlistId}`)
      .set("Cookie", otherCookie);
    expect(remove.status).toBe(404);
  });

  it("shows a public playlist to other users but keeps it read-only", async () => {
    const app = await api();
    const ownerCookie = await signIn(userEmail);
    const playlistId = (
      await app.get("/api/v1/playlists").set("Cookie", ownerCookie)
    ).body.data[0].id as string;

    await app
      
      .patch(`/api/v1/playlists/${playlistId}`)
      .set("Cookie", ownerCookie)
      .send({ isPublic: true });

    const otherCookie = await signIn(otherUserEmail);
    const get = await app.get(`/api/v1/playlists/${playlistId}`).set("Cookie", otherCookie);
    expect(get.status).toBe(200);

    const addItem = await app
      
      .post(`/api/v1/playlists/${playlistId}/items`)
      .set("Cookie", otherCookie)
      .send({ songId });
    expect(addItem.status).toBe(404); // ownership still enforced for mutations
  });

  it("deletes a playlist with its items", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);
    const playlistId = (
      await app.get("/api/v1/playlists").set("Cookie", cookie)
    ).body.data[0].id as string;

    const res = await app.delete(`/api/v1/playlists/${playlistId}`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    const after = await app.get(`/api/v1/playlists/${playlistId}`).set("Cookie", cookie);
    expect(after.status).toBe(404);
  });
});
