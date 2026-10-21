import request from "supertest";
import type { Express } from "express";
import { prisma } from "../src/config/prisma.js";
import { uploadsDir } from "../src/lib/storage.js";

let appInstance: Express | undefined;

/** Returns a supertest client bound to the shared app instance. */
export async function api() {
  if (!appInstance) {
    const { createApp } = await import("../src/app.js");
    appInstance = createApp();
  }
  return request(appInstance);
}

/** Public uploads folder — lets tests clean up files written by the upload endpoint. */
export function uploadsDirForTests(): string {
  return uploadsDir();
}

export async function truncateAll() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE users, sessions, accounts, verifications, artists, songs, videos,
     favorites, playlists, playlist_items, downloads, playback_events, artist_follows,
     page_subscriptions, download_royalties,
     conversations, conversation_participants, messages, message_attachments, calls,
     push_tokens,
     payment_categories, payment_services, payment_service_fields,
     payment_transactions, payment_receipts,
     wallets, wallet_transactions,
     product_categories, products, product_variants, product_images,
     carts, cart_items, orders, order_items, order_addresses
     CASCADE`,
  );
}

export interface TestUser {
  email: string;
  password: string;
  cookie: string;
  userId: string;
  role: string;
}

function extractCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"];
  if (Array.isArray(setCookie)) {
    return setCookie.map((cookie) => cookie.split(";")[0]).join("; ");
  }
  if (typeof setCookie === "string") {
    return setCookie.split(";")[0];
  }
  return "";
}

export async function createUser(
  name: string,
  email: string,
): Promise<TestUser> {
  const app = await api();
  const res = await app
    .post("/api/v1/auth/sign-up/email")
    .send({ name, email, password: "password123" });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Failed to create user ${email}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  return {
    email,
    password: "password123",
    cookie: extractCookie(res),
    userId: res.body.user.id,
    role: res.body.user.role,
  };
}

export async function signIn(
  email: string,
  password = "password123",
): Promise<string> {
  const app = await api();
  const res = await app
    .post("/api/v1/auth/sign-in/email")
    .send({ email, password });
  return extractCookie(res);
}

/** Registers a user and promotes them to an artist with their own profile. */
export async function createArtist(
  name: string,
  email: string,
): Promise<TestUser & { artistId: string }> {
  const user = await createUser(name, email);
  const app = await api();
  const res = await app
    .post("/api/v1/artists")
    .set("Cookie", user.cookie)
    .send({ name });
  if (res.status !== 201) {
    throw new Error(
      `Failed to create artist ${email}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return { ...user, role: "ARTIST", artistId: res.body.data.id };
}

/** Publishes a song for an artist directly through the API. */
export async function publishSong(
  cookie: string,
  artistId: string,
  title: string,
  options?: { isDownloadable?: boolean },
): Promise<string> {
  const app = await api();
  const res = await app
    .post(`/api/v1/artists/${artistId}/songs`)
    .set("Cookie", cookie)
    .send({
      title,
      audioUrl: "https://example.com/audio.mp3",
      isDownloadable: options?.isDownloadable ?? true,
    });
  if (res.status !== 201) {
    throw new Error(
      `Failed to publish song: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.data.id;
}

export async function publishVideo(
  cookie: string,
  artistId: string,
  title: string,
): Promise<string> {
  const app = await api();
  const res = await app
    .post(`/api/v1/artists/${artistId}/videos`)
    .set("Cookie", cookie)
    .send({
      title,
      videoUrl: "https://example.com/video.mp4",
      isDownloadable: true,
    });
  if (res.status !== 201) {
    throw new Error(
      `Failed to publish video: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.data.id;
}

let counter = 0;
export function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@test.local`;
}
