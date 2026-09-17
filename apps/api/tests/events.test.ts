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

describe("Playback events and idempotent offline sync", () => {
  let userEmail: string;
  let songId: string;
  let videoId: string;
  let run = 0;

  const eventId = (label: string, n: number) =>
    `10000000-0000-4000-8000-${`${run}${label}${n}`.padStart(12, "0").slice(-12)}`;

  beforeAll(async () => {
    await truncateAll();
    const user = await createUser("Event User", uniqueEmail("events"));
    userEmail = user.email;
    const artist = await createArtist("Event Artist", uniqueEmail("events-artist"));
    songId = await publishSong(artist.cookie, artist.artistId, "Event Song");
    videoId = await publishVideo(artist.cookie, artist.artistId, "Event Video");
  });

  it("accepts a playback event", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    const res = await app
      
      .post("/api/v1/events/playback")
      .set("Cookie", cookie)
      .send({ eventType: "PLAY", mediaType: "SONG", songId, clientEventId: eventId(1, 1), occurredAt: "2026-09-16T07:00:00Z" });

    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe("ACCEPTED");
  });

  it("does not double-count a replayed event (retry / restart safety)", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    // Same clientEventId sent again — e.g. app retried after a timeout.
    const res = await app
      
      .post("/api/v1/events/playback")
      .set("Cookie", cookie)
      .send({ eventType: "PLAY", mediaType: "SONG", songId, clientEventId: eventId(1, 1), occurredAt: "2026-09-16T07:00:00Z" });

    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe("DUPLICATE");

    const detail = await app.get(`/api/v1/songs/${songId}`);
    expect(detail.body.data.playCount).toBe(1);
  });

  it("synchronizes an offline event batch and reports duplicates", async () => {
    run += 1;
    const app = await api();
    const cookie = await signIn(userEmail);

    const batch = {
      events: [
        { eventType: "PLAY", mediaType: "SONG", songId, clientEventId: eventId(2, 1), occurredAt: "2026-09-16T07:10:00Z" },
        { eventType: "VIEW", mediaType: "VIDEO", videoId, clientEventId: eventId(2, 2), occurredAt: "2026-09-16T07:11:00Z" },
      ],
    };

    const first = await app.post("/api/v1/events/batch").set("Cookie", cookie).send(batch);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ accepted: 2, duplicates: 0, invalid: [] });

    // Simulate a re-sync after a network timeout: the same batch again.
    const second = await app.post("/api/v1/events/batch").set("Cookie", cookie).send(batch);
    expect(second.body.data).toMatchObject({ accepted: 0, duplicates: 2, invalid: [] });

    const song = await app.get(`/api/v1/songs/${songId}`);
    expect(song.body.data.playCount).toBe(2);

    const video = await app.get(`/api/v1/videos/${videoId}`);
    expect(video.body.data.viewCount).toBe(1);
  });

  it("reports invalid events in a batch without failing the rest", async () => {
    run += 1;
    const app = await api();
    const cookie = await signIn(userEmail);

    const res = await app
      
      .post("/api/v1/events/batch")
      .set("Cookie", cookie)
      .send({
        events: [
          { eventType: "PLAY", mediaType: "SONG", songId: "00000000-0000-4000-8000-00000000dead", clientEventId: eventId(3, 1), occurredAt: "2026-09-16T07:20:00Z" },
          { eventType: "PLAY", mediaType: "SONG", songId, clientEventId: eventId(3, 2), occurredAt: "2026-09-16T07:21:00Z" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(1);
    expect(res.body.data.invalid).toHaveLength(1);
    expect(res.body.data.invalid[0].clientEventId).toBe(eventId(3, 1));
  });

  it("rejects malformed events", async () => {
    const app = await api();
    const cookie = await signIn(userEmail);

    const res = await app
      
      .post("/api/v1/events/playback")
      .set("Cookie", cookie)
      .send({ eventType: "PLAY", mediaType: "SONG", clientEventId: "not-a-uuid", occurredAt: "nope" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
