import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { api, createArtist, truncateAll, uniqueEmail, uploadsDirForTests } from "./helpers.js";

// Minimal valid payloads — the endpoint validates by declared mime type.
const WAV_BYTES = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WAVEfmt ", "ascii"),
  Buffer.from([0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00]),
  Buffer.from([0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x02, 0x00, 0x10, 0x00]),
  Buffer.from("data", "ascii"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
]);
const PNG_BYTES = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

describe("Uploads (song/video media)", () => {
  let cookie: string;
  const uploadedKeys: string[] = [];

  beforeAll(async () => {
    await truncateAll();
    const artist = await createArtist("Upload Artist", uniqueEmail("upload"));
    cookie = artist.cookie;
  });

  afterAll(async () => {
    await Promise.all(
      uploadedKeys.map((key) =>
        fs.rm(path.join(uploadsDirForTests(), key), { force: true }),
      ),
    );
  });

  it("requires authentication", async () => {
    const app = await api();
    const res = await app
      .post("/api/v1/uploads?kind=audio")
      .attach("file", WAV_BYTES, { filename: "song.wav", contentType: "audio/wav" });
    expect(res.status).toBe(401);
  });

  it("rejects unknown upload kinds", async () => {
    const app = await api();
    const res = await app
      .post("/api/v1/uploads?kind=song")
      .set("Cookie", cookie)
      .attach("file", WAV_BYTES, { filename: "song.wav", contentType: "audio/wav" });
    expect(res.status).toBe(400);
  });

  it("stores an uploaded song and returns its public URL", async () => {
    const app = await api();
    const res = await app
      .post("/api/v1/uploads?kind=audio")
      .set("Cookie", cookie)
      .attach("file", WAV_BYTES, { filename: "song.wav", contentType: "audio/wav" });
    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe("audio");
    expect(res.body.data.url).toMatch(/^\/uploads\/.+\.wav$/);
    expect(res.body.data.mimeType).toBe("audio/wav");
    expect(res.body.data.fileSizeBytes).toBe(WAV_BYTES.length);
    uploadedKeys.push(res.body.data.storageKey);

    // The file is publicly served from the static /uploads mount.
    const served = await app.get(res.body.data.url);
    expect(served.status).toBe(200);
  });

  it("rejects non-audio files for songs", async () => {
    const app = await api();
    const res = await app
      .post("/api/v1/uploads?kind=audio")
      .set("Cookie", cookie)
      .attach("file", PNG_BYTES, { filename: "cover.png", contentType: "image/png" });
    expect(res.status).toBe(422);
  });

  it("accepts video files for artist videos", async () => {
    const app = await api();
    const res = await app
      .post("/api/v1/uploads?kind=video")
      .set("Cookie", cookie)
      .attach("file", WAV_BYTES, { filename: "clip.mp4", contentType: "video/mp4" });
    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe("video");
    uploadedKeys.push(res.body.data.storageKey);
  });

  it("accepts cover images", async () => {
    const app = await api();
    const res = await app
      .post("/api/v1/uploads?kind=image")
      .set("Cookie", cookie)
      .attach("file", PNG_BYTES, { filename: "cover.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe("image");
    uploadedKeys.push(res.body.data.storageKey);
  });
});
