import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { auth } from "../src/lib/auth.js";

/**
 * Development seed: demo artists and catalog content using public sample
 * media as placeholders. Replace with real storage/CDN URLs later.
 */
const connectionString = process.env["DATABASE_URL"] ?? "";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Shared password for every seeded demo account (listener + creators). */
export const DEMO_PASSWORD = "phoenix123";
const LISTENER_EMAIL = "listener@phoenix.local";

const SOUNDHELIX = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;
const GTV = (name: string) => `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${name}.mp4`;
const GTV_POSTER = (name: string) =>
  `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/${name}.jpg`;

const artists = [
  {
    key: "aurora",
    name: "Aurora Waves",
    bio: "Ambient electronic duo crafting soundscapes for late nights.",
    songs: [
      { title: "Neon Tides", genre: "Electronic", url: SOUNDHELIX(1), duration: 372 },
      { title: "Midnight Drive", genre: "Electronic", url: SOUNDHELIX(2), duration: 425 },
      { title: "Reflections", genre: "Ambient", url: SOUNDHELIX(3), duration: 309 },
      { title: "Aurora Borealis", genre: "Ambient", url: SOUNDHELIX(4), duration: 296 },
    ],
  },
  {
    key: "solaris",
    name: "The Solaris Band",
    bio: "Indie rock quartet from the coast. Loud guitars, bigger choruses.",
    songs: [
      { title: "Golden Hour", genre: "Indie Rock", url: SOUNDHELIX(5), duration: 348 },
      { title: "Static Love", genre: "Indie Rock", url: SOUNDHELIX(6), duration: 383 },
      { title: "Runaway Hearts", genre: "Rock", url: SOUNDHELIX(7), duration: 331 },
    ],
  },
  {
    key: "celeste",
    name: "Celeste Moreau",
    bio: "Franco-Belgian pianist and composer. Minimal, intimate, timeless.",
    songs: [
      { title: "Lettre à Paris", genre: "Classical", url: SOUNDHELIX(8), duration: 356 },
      { title: "Nocturne No. 3", genre: "Classical", url: SOUNDHELIX(9), duration: 284 },
      { title: "Petite Valse", genre: "Classical", url: SOUNDHELIX(10), duration: 244 },
    ],
  },
  {
    key: "kaya",
    name: "Kaya Sound System",
    bio: "Roots reggae collective spreading good vibrations since 2015.",
    songs: [
      { title: "Riddim Rider", genre: "Reggae", url: SOUNDHELIX(11), duration: 395 },
      { title: "Sunset Skank", genre: "Reggae", url: SOUNDHELIX(12), duration: 367 },
      { title: "Dub Voyage", genre: "Dub", url: SOUNDHELIX(13), duration: 412 },
      { title: "Freedom Chant", genre: "Reggae", url: SOUNDHELIX(14), duration: 353 },
    ],
  },
];

const videos = [
  { title: "Big Buck Bunny", artist: "aurora", description: "A giant rabbit with a big heart.", url: GTV("BigBuckBunny"), duration: 596 },
  { title: "Sintel", artist: "aurora", description: "A girl's quest to find her dragon.", url: GTV("Sintel"), duration: 888 },
  { title: "Tears of Steel", artist: "solaris", description: "Sci-fi short filmed in Amsterdam.", url: GTV("TearsOfSteel"), duration: 734 },
  { title: "Elephants Dream", artist: "solaris", description: "The first open movie, still surreal.", url: GTV("ElephantsDream"), duration: 653 },
  { title: "For Bigger Fun", artist: "celeste", description: "Chromecast original short.", url: GTV("ForBiggerFun"), duration: 60 },
  { title: "For Bigger Joyrides", artist: "celeste", description: "Chromecast original short.", url: GTV("ForBiggerJoyrides"), duration: 15 },
  { title: "For Bigger Escape", artist: "kaya", description: "Chromecast original short.", url: GTV("ForBiggerEscapes"), duration: 15 },
  { title: "For Bigger Blazes", artist: "kaya", description: "Chromecast original short.", url: GTV("ForBiggerBlazes"), duration: 15 },
] as const;

/** Deterministic demo usage metrics so creator stats are not all zeros. */
function demoCounts(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return {
    primary: 120 + (hash % 880), // plays or views
    downloads: 10 + (hash % 90),
  };
}

/**
 * Creates (or resets) a login-ready demo account. Signup goes through
 * better-auth so password hashing/account rows stay in sync with the auth
 * system; role and emailVerified are then set directly.
 */
async function ensureDemoUser(input: { email: string; name: string; role: "USER" | "ARTIST" }): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (!existing) {
    await auth.api.signUpEmail({
      body: { email: input.email, name: input.name, password: DEMO_PASSWORD },
    });
  }
  const user = await prisma.user.update({
    where: { email: input.email },
    data: { emailVerified: true, role: input.role },
  });
  return user.id;
}

async function main() {
  console.log("Seeding Phoenix development data...");

  const createdArtists = new Map<string, string>();

  for (const artist of artists) {
    // Owner accounts are login-ready creators (e.g. aurora@phoenix.local).
    const user = await ensureDemoUser({
      email: `${artist.key}@phoenix.local`,
      name: artist.name,
      role: "ARTIST",
    });

    const record = await prisma.artist.upsert({
      where: { userId: user },
      update: { bio: artist.bio },
      create: { userId: user, name: artist.name, bio: artist.bio },
    });
    createdArtists.set(artist.key, record.id);
    console.log(`  artist: ${artist.name}`);
  }

  // Normal listener account with one follow, demonstrating the fan side.
  const listenerId = await ensureDemoUser({
    email: LISTENER_EMAIL,
    name: "Nina Listener",
    role: "USER",
  });
  await prisma.artistFollow.upsert({
    where: {
      userId_artistId: { userId: listenerId, artistId: createdArtists.get("aurora")! },
    },
    update: {},
    create: { userId: listenerId, artistId: createdArtists.get("aurora")! },
  });
  console.log(`  listener: ${LISTENER_EMAIL} (follows Aurora Waves)`);

  let songCount = 0;
  for (const artist of artists) {
    const artistId = createdArtists.get(artist.key)!;
    for (const song of artist.songs) {
      const counts = demoCounts(`${artist.key}:${song.title}`);
      const data = {
        playCount: counts.primary,
        downloadCount: counts.downloads,
      };
      const existing = await prisma.song.findFirst({
        where: { title: song.title, artistId },
        select: { id: true },
      });
      if (existing) {
        await prisma.song.update({ where: { id: existing.id }, data });
        continue;
      }
      await prisma.song.create({
        data: {
          artistId,
          title: song.title,
          genre: song.genre,
          audioUrl: song.url,
          mimeType: "audio/mpeg",
          durationSec: song.duration,
          isDownloadable: true,
          ...data,
        },
      });
      songCount += 1;
    }
  }
  console.log(`  songs: ${songCount} created`);

  let videoCount = 0;
  for (const video of videos) {
    const artistId = createdArtists.get(video.artist)!;
    const counts = demoCounts(`${video.artist}:${video.title}`);
    const data = {
      viewCount: counts.primary,
      downloadCount: counts.downloads,
    };
    const existing = await prisma.video.findFirst({
      where: { title: video.title, artistId },
      select: { id: true },
    });
    if (existing) {
      await prisma.video.update({ where: { id: existing.id }, data });
      continue;
    }
    await prisma.video.create({
      data: {
        artistId,
        title: video.title,
        description: video.description,
        videoUrl: video.url,
        thumbnailUrl: GTV_POSTER(video.url.split("/").pop()!.replace(".mp4", "")),
        mimeType: "video/mp4",
        durationSec: video.duration,
        isDownloadable: true,
        ...data,
      },
    });
    videoCount += 1;
  }
  console.log(`  videos: ${videoCount} created`);
  console.log(`  demo accounts: password "${DEMO_PASSWORD}" for listener@phoenix.local + creators`);
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
