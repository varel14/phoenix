import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

// NOTE: no static import of helpers/app modules here — importing anything that
// transitively loads src/config/env.ts would evaluate the env singleton before
// the R2 env vars are stubbed below.

// Mocks must be declared before the module under test is imported.
const s3Mocks = vi.hoisted(() => ({
  send: vi.fn(async () => ({})),
  uploads: [] as Array<Record<string, unknown>>,
  signedCommands: [] as Array<Record<string, unknown>>,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    config: unknown;
    send = s3Mocks.send;
    constructor(config: unknown) {
      this.config = config;
    }
  },
  PutObjectCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
  GetObjectCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
  DeleteObjectCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    constructor(config: { params: Record<string, unknown> }) {
      s3Mocks.uploads.push(config.params);
    }
    done() {
      return Promise.resolve({});
    }
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (_client: unknown, command: { input: Record<string, unknown> }) => {
    s3Mocks.signedCommands.push(command.input);
    return `https://presigned.test/${String(command.input["Key"])}?sig=abc`;
  }),
}));

// R2 credentials must be in place before env.ts is evaluated.
vi.stubEnv("R2_ACCOUNT_ID", "test-account");
vi.stubEnv("R2_ACCESS_KEY_ID", "test-key");
vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
vi.stubEnv("R2_BUCKET", "phoenix-media");
vi.stubEnv("R2_PUBLIC_BASE_URL", "https://pub-test.r2.dev");

let objectStorage: typeof import("../src/lib/object-storage.js");

beforeAll(async () => {
  objectStorage = await import("../src/lib/object-storage.js");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("object storage (R2 backend)", () => {
  it("reports R2 as configured", () => {
    expect(objectStorage.isR2Configured()).toBe(true);
  });

  it("streams public uploads into the bucket under a kind folder", async () => {
    // Multer would have landed the file here before the controller runs.
    const tempPath = path.join(process.cwd(), "..", "uploads", "song-1.wav");
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, "fake-wav-bytes");

    const stored = await objectStorage.storeUpload("audio", {
      filename: "song-1.wav",
      mimetype: "audio/wav",
    });
    expect(stored).toEqual({ url: "https://pub-test.r2.dev/audio/song-1.wav", storageKey: "audio/song-1.wav" });
    expect(s3Mocks.uploads[0]).toMatchObject({
      Bucket: "phoenix-media",
      Key: "audio/song-1.wav",
      ContentType: "audio/wav",
    });
    // The local temp copy is removed once the object lives in the bucket.
    await expect(fs.access(tempPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps digital files private (no public URL)", async () => {
    const tempPath = path.join(process.cwd(), "..", "digital-files", "album.pdf");
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, "fake-pdf-bytes");

    const stored = await objectStorage.storeUpload("digital", {
      filename: "album.pdf",
      mimetype: "application/pdf",
    });
    expect(stored.url).toBeNull();
    expect(stored.storageKey).toBe("digital/album.pdf");
    await expect(fs.access(tempPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("builds public URLs without double slashes", () => {
    expect(objectStorage.r2PublicUrl("images/c.jpg")).toBe("https://pub-test.r2.dev/images/c.jpg");
  });

  it("deletes objects from the bucket", async () => {
    await objectStorage.deleteStoredObject("audio/song-1.wav");
    expect(s3Mocks.send).toHaveBeenCalledTimes(1);
    // DeleteObjectCommand input is captured by the mocked class constructor.
    const deleteInput = s3Mocks.send.mock.calls[0]?.[0] as { input?: Record<string, unknown> };
    expect(deleteInput.input).toMatchObject({ Bucket: "phoenix-media", Key: "audio/song-1.wav" });
  });

  it("presigns short-lived digital downloads with a filename disposition", async () => {
    const url = await objectStorage.presignDigitalDownload("digital/album.pdf", "Mon Album.pdf");
    expect(url).toBe("https://presigned.test/digital/album.pdf?sig=abc");
    expect(s3Mocks.signedCommands[0]).toMatchObject({
      Bucket: "phoenix-media",
      Key: "digital/album.pdf",
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent("Mon Album.pdf")}"`,
    });
  });
});
