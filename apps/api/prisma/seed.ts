import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { auth } from "../src/lib/auth.js";
import { listThumbnailFiles, thumbnailsDir } from "../src/lib/thumbnails.js";
import { digitalFilesDir, uploadsDir } from "../src/lib/storage.js";
import {
  ensureBucketFile,
  isR2Configured,
  r2PublicUrl,
} from "../src/lib/object-storage.js";
import { env } from "../src/config/env.js";

/**
 * Development seed: demo artists and catalog content using public sample
 * media as placeholders, plus a fully-stocked "world" for the test account
 * (user@gmail.com): every user-scoped entity has >= 10 rows so all
 * app features can be exercised without manual setup.
 */
const connectionString = process.env["DATABASE_URL"] ?? "";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Shared password for the secondary demo accounts (creators + friends). */
export const DEMO_PASSWORD = "phoenix123";
/** Canonical credentials surfaced on the login screen. */
export const CANONICAL_LISTENER_EMAIL = "user@gmail.com";
export const CANONICAL_ARTIST_EMAIL = "artist@gmail.com";
export const CANONICAL_PASSWORD = "password";
const LISTENER_EMAIL = CANONICAL_LISTENER_EMAIL;
/** Extra people for conversations, groups and calls with the test user. */
const FRIENDS = [
  { email: "marie@phoenix.local", name: "Marie Doumbia" },
  { email: "david@phoenix.local", name: "David Koffi" },
  { email: "grace@phoenix.local", name: "Grace Adjoua" },
  { email: "imran@phoenix.local", name: "Imran Bakayoko" },
];

const SOUNDHELIX = (n: number) =>
  `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${((n - 1) % 16) + 1}.mp3`;
const GTV = (name: string) =>
  `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${name}.mp4`;
const GTV_POSTER = (name: string) =>
  `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/${name}.jpg`;

/** Content-type for seed asset files, keyed by extension. */
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
};

const mimeFor = (file: string) =>
  MIME_BY_EXT[path.extname(file).toLowerCase()] ?? "application/octet-stream";

/**
 * URL resolver for local asset references. With R2 configured it rewrites
 * /thumbnails/… and /uploads/… paths to their bucket URLs; otherwise URLs
 * pass through unchanged and are served from local disk (express.static).
 */
let resolveAssetUrl: (url: string) => string = (url) => url;

/** Demo digital files referenced by seeded products (bucket key = file name, matching digitalStorageKey). */
const DEMO_DIGITAL_FILES = [
  "demo-ebook-memoires.pdf",
  "demo-audiobook-neon-tides.mp3",
  "demo-ebook-recettes.pdf",
  "demo-audiobook-lettres.mp3",
];

/**
 * Copies the committed chat fixtures (prisma/fixtures/seed) into the runtime
 * uploads folder, so seeded conversations render on a fresh clone.
 */
function copySeedFixtures(): void {
  const fixturesDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures/seed",
  );
  if (!existsSync(fixturesDir)) return;
  const targetDir = path.join(uploadsDir(), "seed");
  mkdirSync(targetDir, { recursive: true });
  for (const file of readdirSync(fixturesDir)) {
    const target = path.join(targetDir, file);
    if (!existsSync(target)) copyFileSync(path.join(fixturesDir, file), target);
  }
}

/**
 * With R2 configured, mirrors the local asset libraries into the bucket
 * (idempotent — existing objects are skipped) and rewrites local asset URLs
 * to bucket URLs. Songs/videos keep their remote demo URLs.
 */
async function publishSeedAssets(): Promise<void> {
  if (!isR2Configured() || !env.R2_PUBLIC_BASE_URL) return;
  for (const file of listThumbnailFiles()) {
    await ensureBucketFile(
      `thumbnails/${file}`,
      path.join(thumbnailsDir(), file),
      mimeFor(file),
    );
  }
  const seedDir = path.join(uploadsDir(), "seed");
  if (existsSync(seedDir)) {
    for (const file of readdirSync(seedDir)) {
      await ensureBucketFile(
        `seed/${file}`,
        path.join(seedDir, file),
        mimeFor(file),
      );
    }
  }
  for (const name of DEMO_DIGITAL_FILES) {
    const filePath = path.join(digitalFilesDir(), name);
    if (existsSync(filePath))
      await ensureBucketFile(name, filePath, mimeFor(name));
  }
  resolveAssetUrl = (url) => {
    // Chat fixtures live in the bucket under their storage key ("seed/…"),
    // which drops the "/uploads/" prefix their serving URL carries.
    if (url.startsWith("/uploads/"))
      return r2PublicUrl(url.replace(/^\/uploads\//, "")) ?? url;
    if (url.startsWith("/thumbnails/")) return r2PublicUrl(url.slice(1)) ?? url;
    return url;
  };
  console.log("  assets: local libraries mirrored to R2");
}

const artists = [
  {
    key: "aurora",
    name: "Aurora Waves",
    bio: "Ambient electronic duo crafting soundscapes for late nights.",
    songs: [
      {
        title: "Neon Tides",
        album: "Tidal Memory",
        genre: "Electronic",
        url: SOUNDHELIX(1),
        duration: 372,
      },
      {
        title: "Midnight Drive",
        album: "Tidal Memory",
        genre: "Electronic",
        url: SOUNDHELIX(2),
        duration: 425,
      },
      {
        title: "Reflections",
        album: "Polar",
        genre: "Ambient",
        url: SOUNDHELIX(3),
        duration: 309,
      },
      {
        title: "Aurora Borealis",
        album: "Polar",
        genre: "Ambient",
        url: SOUNDHELIX(4),
        duration: 296,
      },
    ],
  },
  {
    key: "solaris",
    name: "The Solaris Band",
    bio: "Indie rock quartet from the coast. Loud guitars, bigger choruses.",
    songs: [
      {
        title: "Golden Hour",
        album: "Golden Hour",
        genre: "Indie Rock",
        url: SOUNDHELIX(5),
        duration: 348,
      },
      {
        title: "Static Love",
        album: "Golden Hour",
        genre: "Indie Rock",
        url: SOUNDHELIX(6),
        duration: 383,
      },
      {
        title: "Runaway Hearts",
        album: "Golden Hour",
        genre: "Rock",
        url: SOUNDHELIX(7),
        duration: 331,
      },
    ],
  },
  {
    key: "celeste",
    name: "Celeste Moreau",
    bio: "Franco-Belgian pianist and composer. Minimal, intimate, timeless.",
    songs: [
      {
        title: "Lettre à Paris",
        album: "Lettres Vol. 1",
        genre: "Classical",
        url: SOUNDHELIX(8),
        duration: 356,
      },
      {
        title: "Nocturne No. 3",
        album: "Lettres Vol. 1",
        genre: "Classical",
        url: SOUNDHELIX(9),
        duration: 284,
      },
      {
        title: "Petite Valse",
        album: "Lettres Vol. 1",
        genre: "Classical",
        url: SOUNDHELIX(10),
        duration: 244,
      },
    ],
  },
  {
    key: "kaya",
    name: "Kaya Sound System",
    bio: "Roots reggae collective spreading good vibrations since 2015.",
    songs: [
      {
        title: "Riddim Rider",
        album: "Sound System Sessions",
        genre: "Reggae",
        url: SOUNDHELIX(11),
        duration: 395,
      },
      {
        title: "Sunset Skank",
        album: "Sound System Sessions",
        genre: "Reggae",
        url: SOUNDHELIX(12),
        duration: 367,
      },
      {
        title: "Dub Voyage",
        album: "Sound System Sessions",
        genre: "Dub",
        url: SOUNDHELIX(13),
        duration: 412,
      },
      {
        title: "Freedom Chant",
        album: "Sound System Sessions",
        genre: "Reggae",
        url: SOUNDHELIX(14),
        duration: 353,
      },
    ],
  },
  // Extra artists so the test user can follow & subscribe to 10+ pages.
  {
    key: "nadia",
    name: "Nadia Kora",
    bio: "Kora moderne et voix cristalline — un pont entre tradition mandingue et électro.",
    songs: [
      {
        title: "Fils du Fleuve",
        album: "Fleuve",
        genre: "Afro-Kora",
        url: SOUNDHELIX(15),
        duration: 341,
      },
      {
        title: "Lune de Sikasso",
        album: "Fleuve",
        genre: "Afro-Kora",
        url: SOUNDHELIX(16),
        duration: 298,
      },
    ],
  },
  {
    key: "brickz",
    name: "Brickz 225",
    bio: "Coupé-décalé, abidjanais et fier. L'ambiance d'abord.",
    songs: [
      {
        title: "Gboka Dance",
        album: "225 Vol. 2",
        genre: "Coupé-Décalé",
        url: SOUNDHELIX(3),
        duration: 315,
      },
      {
        title: "Yako City",
        album: "225 Vol. 2",
        genre: "Coupé-Décalé",
        url: SOUNDHELIX(7),
        duration: 288,
      },
    ],
  },
  {
    key: "aminata",
    name: "Aminata Soul",
    bio: "Soul africaine, textes en bambara et en français.",
    songs: [
      {
        title: "Deni Wélé",
        album: "Soul Bamako",
        genre: "Soul",
        url: SOUNDHELIX(5),
        duration: 357,
      },
      {
        title: "Keneya",
        album: "Soul Bamako",
        genre: "Soul",
        url: SOUNDHELIX(9),
        duration: 322,
      },
    ],
  },
  {
    key: "djossa",
    name: "Djossa Vibration",
    bio: "Zouglou engagé, chœurs massifs, daoulio incontournable.",
    songs: [
      {
        title: "Souffrance Étudiante",
        album: "Cité Verte",
        genre: "Zouglou",
        url: SOUNDHELIX(11),
        duration: 402,
      },
      {
        title: "Ambiance à Gbagba",
        album: "Cité Verte",
        genre: "Zouglou",
        url: SOUNDHELIX(13),
        duration: 375,
      },
    ],
  },
  {
    key: "lyres",
    name: "Les Lyres d'Ébène",
    bio: "Jazz manouche ivoirien, improvisations fiévreuses.",
    songs: [
      {
        title: "Swing de Cocody",
        album: "Ébène",
        genre: "Jazz",
        url: SOUNDHELIX(1),
        duration: 289,
      },
      {
        title: "Rue des Jardins",
        album: "Ébène",
        genre: "Jazz",
        url: SOUNDHELIX(4),
        duration: 331,
      },
    ],
  },
  {
    key: "fula",
    name: "Fula Flute Collective",
    bio: "Flûtes peules, kora, percussions — musique du Sahel réinventée.",
    songs: [
      {
        title: "Pastorale du Ferlo",
        album: "Sahel Nomade",
        genre: "World",
        url: SOUNDHELIX(6),
        duration: 368,
      },
      {
        title: "Danse des Bergers",
        album: "Sahel Nomade",
        genre: "World",
        url: SOUNDHELIX(10),
        duration: 294,
      },
    ],
  },
  {
    key: "mfoni",
    name: "Mfoni",
    bio: "Afrobeat nouvelle vague, produite entre Abidjan et Lagos.",
    songs: [
      {
        title: "Shayo Night",
        album: "Lagos-Abidjan",
        genre: "Afrobeat",
        url: SOUNDHELIX(12),
        duration: 267,
      },
      {
        title: "Oya Come Through",
        album: "Lagos-Abidjan",
        genre: "Afrobeat",
        url: SOUNDHELIX(14),
        duration: 243,
      },
    ],
  },
  {
    key: "sahel",
    name: "Sahel Blues",
    bio: "Blues du désert, guitares tranchantes comme le Harmattan.",
    songs: [
      {
        title: "Imidiwan",
        album: "Harmattan",
        genre: "Desert Blues",
        url: SOUNDHELIX(2),
        duration: 384,
      },
      {
        title: "Tenere Nights",
        album: "Harmattan",
        genre: "Desert Blues",
        url: SOUNDHELIX(8),
        duration: 351,
      },
    ],
  },
];

const videos = [
  {
    title: "Big Buck Bunny",
    artist: "aurora",
    description: "A giant rabbit with a big heart.",
    url: GTV("BigBuckBunny"),
    duration: 596,
  },
  {
    title: "Sintel",
    artist: "aurora",
    description: "A girl's quest to find her dragon.",
    url: GTV("Sintel"),
    duration: 888,
  },
  {
    title: "Tears of Steel",
    artist: "solaris",
    description: "Sci-fi short filmed in Amsterdam.",
    url: GTV("TearsOfSteel"),
    duration: 734,
  },
  {
    title: "Elephants Dream",
    artist: "solaris",
    description: "The first open movie, still surreal.",
    url: GTV("ElephantsDream"),
    duration: 653,
  },
  {
    title: "For Bigger Fun",
    artist: "celeste",
    description: "Chromecast original short.",
    url: GTV("ForBiggerFun"),
    duration: 60,
  },
  {
    title: "For Bigger Joyrides",
    artist: "celeste",
    description: "Chromecast original short.",
    url: GTV("ForBiggerJoyrides"),
    duration: 15,
  },
  {
    title: "For Bigger Escape",
    artist: "kaya",
    description: "Chromecast original short.",
    url: GTV("ForBiggerEscapes"),
    duration: 15,
  },
  {
    title: "For Bigger Blazes",
    artist: "kaya",
    description: "Chromecast original short.",
    url: GTV("ForBiggerBlazes"),
    duration: 15,
  },
  {
    title: "For Bigger Meltdowns",
    artist: "nadia",
    description: "Clip live studio — kora & claviers.",
    url: GTV("ForBiggerMeltdowns"),
    duration: 15,
  },
  {
    title: "Subaru Outback — road trip 225",
    artist: "brickz",
    description: "Le clip road trip tourné sur la route de Bingerville.",
    url: GTV("SubaruOutbackOnStreetAndDirt"),
    duration: 594,
  },
  {
    title: "VW GTI — session studio",
    artist: "mfoni",
    description: "Session acoustique improvisée dans le 4-4.",
    url: GTV("VolkswagenGTIReview"),
    duration: 173,
  },
  {
    title: "We Are Going On Bullrun",
    artist: "sahel",
    description: "Carnet de route de la tournée saharienne.",
    url: GTV("WeAreGoingOnBullrun"),
    duration: 47,
  },
] as const;

/** Deterministic demo usage metrics so creator stats are not all zeros. */
function demoCounts(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return {
    primary: 120 + (hash % 880), // plays or views
    downloads: 10 + (hash % 90),
  };
}

/** Balanced-random artwork dealer over apps/thumbnails (null when missing). */
function createArtworkDealer() {
  const files = listThumbnailFiles();
  if (files.length === 0) {
    console.warn(
      "  no images found in apps/thumbnails — falling back to remote posters",
    );
    return () => null;
  }
  for (let i = files.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [files[i], files[j]] = [files[j]!, files[i]!];
  }
  let cursor = 0;
  console.log(`  artwork pool: ${files.length} images from apps/thumbnails`);
  return () =>
    resolveAssetUrl(`/thumbnails/${files[cursor++ % files.length]!}`);
}

/**
 * Creates (or resets) a login-ready demo account. Signup goes through
 * better-auth so password hashing/account rows stay in sync with the auth
 * system; role and emailVerified are then set directly.
 */
async function ensureDemoUser(input: {
  email: string;
  name: string;
  role: "USER" | "ARTIST";
  password?: string;
}): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (!existing) {
    await auth.api.signUpEmail({
      body: {
        email: input.email,
        name: input.name,
        password: input.password ?? DEMO_PASSWORD,
      },
    });
  }
  const user = await prisma.user.update({
    where: { email: input.email },
    data: { emailVerified: true, role: input.role },
  });
  if (input.password) {
    // Keep canonical credentials in sync even when the account predates this
    // seed (e.g. a renamed owner still carrying an old password — or no
    // credential row at all).
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(input.password);
    const account = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
      select: { id: true },
    });
    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: hash },
      });
    } else {
      await prisma.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: hash,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }
  return user.id;
}

async function main() {
  console.log("Seeding Phoenix development data...");
  copySeedFixtures();
  await publishSeedAssets();
  const nextArtwork = createArtworkDealer();
  // All songs of an album share its cover; albums and videos draw from the
  // same balanced rotation.
  const albumArtwork = new Map<string, string>();
  const artworkForAlbum = (album: string) => {
    if (!albumArtwork.has(album)) {
      const artwork = nextArtwork();
      if (!artwork) return null;
      albumArtwork.set(album, artwork);
    }
    return albumArtwork.get(album) ?? null;
  };

  const createdArtists = new Map<string, string>();

  // The canonical artist account (artist@gmail.com) owns the aurora catalog.
  // Rebrand the legacy aurora owner in place so its Artist row, songs and
  // boutique products are preserved (never duplicated).
  const legacyAurora = await prisma.user.findUnique({
    where: { email: "aurora@phoenix.local" },
    select: { id: true },
  });
  const canonicalArtistUser = await prisma.user.findUnique({
    where: { email: CANONICAL_ARTIST_EMAIL },
    select: { id: true },
  });
  if (legacyAurora && !canonicalArtistUser) {
    await prisma.user.update({
      where: { id: legacyAurora.id },
      data: { email: CANONICAL_ARTIST_EMAIL },
    });
  }

  for (const artist of artists) {
    // Owner accounts are login-ready creators (e.g. solaris@phoenix.local);
    // the canonical artist account (artist@gmail.com) owns the aurora catalog.
    const isCanonical = artist.key === "aurora";
    const user = await ensureDemoUser({
      email: isCanonical
        ? CANONICAL_ARTIST_EMAIL
        : `${artist.key}@phoenix.local`,
      name: artist.name,
      role: "ARTIST",
      ...(isCanonical ? { password: CANONICAL_PASSWORD } : {}),
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
    password: CANONICAL_PASSWORD,
  });

  let songCount = 0;
  for (const artist of artists) {
    const artistId = createdArtists.get(artist.key)!;
    for (const song of artist.songs) {
      const counts = demoCounts(`${artist.key}:${song.title}`);
      const data = {
        albumName: song.album,
        thumbnailUrl: artworkForAlbum(song.album),
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
      thumbnailUrl:
        nextArtwork() ??
        GTV_POSTER(video.url.split("/").pop()!.replace(".mp4", "")),
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
        mimeType: "video/mp4",
        durationSec: video.duration,
        isDownloadable: true,
        ...data,
      },
    });
    videoCount += 1;
  }
  console.log(`  videos: ${videoCount} created`);

  await seedPaymentCatalog();
  await seedMarketplace(createdArtists);
  await seedPrayerCategories();
  await seedAdPlacements();

  await seedTestUserWorld({ listenerId, createdArtists });

  console.log(
    `  demo accounts: ${CANONICAL_LISTENER_EMAIL} / ${CANONICAL_ARTIST_EMAIL} — password "${CANONICAL_PASSWORD}" (friends: ${DEMO_PASSWORD})`,
  );
  console.log("Seed complete.");
}

// ---------------------------------------------------------------------------
// Chuyassi Emmanuel Pay / Exchange catalog
// ---------------------------------------------------------------------------

async function seedPaymentCatalog() {
  const categories = [
    {
      name: "Frais scolaires",
      slug: "frais-scolaires",
      icon: "school",
      sortOrder: 1,
    },
    { name: "Factures", slug: "factures", icon: "flash", sortOrder: 2 },
    {
      name: "Services administratifs",
      slug: "services-administratifs",
      icon: "document",
      sortOrder: 3,
    },
    {
      name: "Services partenaires",
      slug: "services-partenaires",
      icon: "business",
      sortOrder: 4,
    },
    {
      name: "Autres services",
      slug: "autres-services",
      icon: "more",
      sortOrder: 5,
    },
  ];
  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const record = await prisma.paymentCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: category,
    });
    categoryIds.set(category.slug, record.id);
  }

  const services = [
    {
      category: "frais-scolaires",
      name: "Frais de scolarité — Lycée",
      description:
        "Réglez les frais de scolarité d'un élève dans un établissement partenaire.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 5000,
      fields: [
        {
          key: "studentName",
          label: "Nom de l'élève",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "school",
          label: "Établissement",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 1,
        },
        {
          key: "matricule",
          label: "Matricule",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
        {
          key: "class",
          label: "Classe",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 3,
        },
        {
          key: "phone",
          label: "Téléphone",
          type: "PHONE" as const,
          options: null as string[] | null,
          sortOrder: 4,
        },
      ],
    },
    {
      category: "frais-scolaires",
      name: "Frais universitaires",
      description:
        "Inscriptions, réinscriptions et frais académiques universitaires.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 10000,
      fields: [
        {
          key: "studentName",
          label: "Nom de l'étudiant",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "university",
          label: "Université",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 1,
        },
        {
          key: "matricule",
          label: "Matricule",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
        {
          key: "phone",
          label: "Téléphone",
          type: "PHONE" as const,
          options: null as string[] | null,
          sortOrder: 3,
        },
      ],
    },
    {
      category: "factures",
      name: "Facture d'électricité",
      description: "Payez votre facture d'électricité en quelques secondes.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 500,
      fields: [
        {
          key: "customerNumber",
          label: "Numéro client",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "invoiceRef",
          label: "Référence facture",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 1,
        },
        {
          key: "phone",
          label: "Téléphone",
          type: "PHONE" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
      ],
    },
    {
      category: "factures",
      name: "Facture d'eau",
      description: "Règlement des factures d'eau des concessions urbaines.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 500,
      fields: [
        {
          key: "customerNumber",
          label: "Numéro client",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "invoiceRef",
          label: "Référence facture",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 1,
        },
        {
          key: "phone",
          label: "Téléphone",
          type: "PHONE" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
      ],
    },
    {
      category: "factures",
      name: "Recharge TV par satellite",
      description: "Rechargez votre abonnement télévision par satellite.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 1000,
      fields: [
        {
          key: "decoderNumber",
          label: "Numéro de décodeur",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "formula",
          label: "Formule",
          type: "SELECT" as const,
          options: ["Basic", "Famille", "Sport +"],
          sortOrder: 1,
        },
        {
          key: "phone",
          label: "Téléphone",
          type: "PHONE" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
      ],
    },
    {
      category: "services-administratifs",
      name: "Extrait d'acte de naissance",
      description: "Demandez et payez un extrait d'acte de naissance.",
      pricingMode: "FIXED" as const,
      fixedPrice: 1500,
      minPrice: null as number | null,
      fields: [
        {
          key: "fullName",
          label: "Nom complet",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "birthDate",
          label: "Date de naissance",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 1,
        },
        {
          key: "birthPlace",
          label: "Lieu de naissance",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
      ],
    },
    {
      category: "services-administratifs",
      name: "Certificat de résidence",
      description: "Certificat de résidence délivré par les autorités locales.",
      pricingMode: "FIXED" as const,
      fixedPrice: 1000,
      minPrice: null as number | null,
      fields: [
        {
          key: "fullName",
          label: "Nom complet",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "quarter",
          label: "Quartier de résidence",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 1,
        },
      ],
    },
    {
      category: "services-administratifs",
      name: "Frais d'examen officiel",
      description: "Inscription aux examens nationaux (CEPE, BEPC, BAC).",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 3000,
      fields: [
        {
          key: "candidateName",
          label: "Nom du candidat",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "examType",
          label: "Examen",
          type: "SELECT" as const,
          options: ["CEPE", "BEPC", "BAC"],
          sortOrder: 1,
        },
        {
          key: "center",
          label: "Centre d'examen",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
        {
          key: "phone",
          label: "Téléphone",
          type: "PHONE" as const,
          options: null as string[] | null,
          sortOrder: 3,
        },
      ],
    },
    {
      category: "services-partenaires",
      name: "Abonnement Internet partenaire",
      description: "Rechargez votre abonnement Internet chez nos partenaires.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 1000,
      fields: [
        {
          key: "accountNumber",
          label: "Numéro de compte",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "plan",
          label: "Formule",
          type: "SELECT" as const,
          options: ["Jour", "Semaine", "Mois"],
          sortOrder: 1,
        },
      ],
    },
    {
      category: "services-partenaires",
      name: "Billet de transport intercity",
      description:
        "Réservez et payez votre billet de bus ou de train intercity.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 2000,
      fields: [
        {
          key: "company",
          label: "Compagnie",
          type: "SELECT" as const,
          options: ["UtB", "GB Express", "Sotra Inter"],
          sortOrder: 0,
        },
        {
          key: "departure",
          label: "Départ",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 1,
        },
        {
          key: "arrival",
          label: "Arrivée",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
        {
          key: "travelDate",
          label: "Date de voyage",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 3,
        },
        {
          key: "phone",
          label: "Téléphone",
          type: "PHONE" as const,
          options: null as string[] | null,
          sortOrder: 4,
        },
      ],
    },
    {
      category: "autres-services",
      name: "Don à l'église / association",
      description: "Soutenez une église ou une association partenaire.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 100,
      fields: [
        {
          key: "organization",
          label: "Organisation",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 0,
        },
        {
          key: "donorName",
          label: "Nom du donateur",
          type: "TEXT" as const,
          options: null as string[] | null,
          sortOrder: 1,
        },
        {
          key: "phone",
          label: "Téléphone",
          type: "PHONE" as const,
          options: null as string[] | null,
          sortOrder: 2,
        },
      ],
    },
  ];

  for (const service of services) {
    const existing = await prisma.paymentService.findFirst({
      where: { name: service.name },
      select: { id: true },
    });
    const base = {
      categoryId: categoryIds.get(service.category)!,
      name: service.name,
      description: service.description,
      pricingMode: service.pricingMode,
      fixedPrice: service.fixedPrice,
      minPrice: service.minPrice,
    };
    const fieldRows = service.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: true,
      options: field.options,
      sortOrder: field.sortOrder,
    }));
    if (existing) {
      await prisma.paymentService.update({
        where: { id: existing.id },
        data: base,
      });
      await prisma.paymentServiceField.deleteMany({
        where: { serviceId: existing.id },
      });
      await prisma.paymentServiceField.createMany({
        data: fieldRows.map((row) => ({ ...row, serviceId: existing.id })),
      });
      continue;
    }
    await prisma.paymentService.create({
      data: { ...base, fields: { create: fieldRows } },
    });
  }
  console.log(`  payment services: ${services.length} ready`);
}

// ---------------------------------------------------------------------------
// Boutique / Marketplace catalog
// ---------------------------------------------------------------------------

const THUMB = (file: string) => resolveAssetUrl(`/thumbnails/${file}`);

async function seedMarketplace(createdArtists: Map<string, string>) {
  const categories = [
    {
      name: "Livres & E-books",
      slug: "livres",
      imageUrl: THUMB("istockphoto-1031437062-612x612.jpg"),
      sortOrder: 1,
    },
    {
      name: "Audiobooks",
      slug: "audiobooks",
      imageUrl: THUMB("pexels-yankrukov-9005465.jpg"),
      sortOrder: 2,
    },
    {
      name: "Vêtements",
      slug: "vetements",
      imageUrl: THUMB("pexels-yasinaydin-14984551.jpg"),
      sortOrder: 3,
    },
    {
      name: "Bijoux",
      slug: "bijoux",
      imageUrl: THUMB("pexels-tolgaaslanturk-10781266.jpg"),
      sortOrder: 4,
    },
    {
      name: "Chaussures",
      slug: "chaussures",
      imageUrl: THUMB("istockphoto-486420378-612x612.jpg"),
      sortOrder: 5,
    },
    {
      name: "Merch artiste",
      slug: "merch",
      imageUrl: THUMB("pexels-mart-production-7271800.jpg"),
      sortOrder: 6,
    },
  ];
  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const record = await prisma.productCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, imageUrl: category.imageUrl },
      create: category,
    });
    categoryIds.set(category.slug, record.id);
  }

  const products: Array<{
    name: string;
    seller: string;
    category: string;
    type: "PHYSICAL" | "DIGITAL";
    price: number;
    stock?: number;
    description: string;
    digitalStorageKey?: string;
    downloadLimit?: number;
    images: string[];
    variants: Array<{ name: string; sku: string; stock: number }>;
  }> = [
    {
      name: "Livre numérique — Mémoires d'Aurora (PDF)",
      seller: "aurora",
      category: "livres",
      type: "DIGITAL",
      price: 3500,
      description:
        "Le premier livre numérique d'Aurora Waves : coulisses de création, partitions commentées et photos inédites. Téléchargement PDF après paiement.",
      digitalStorageKey: "demo-ebook-memoires.pdf",
      downloadLimit: 5,
      images: [THUMB("istockphoto-1031437062-612x612.jpg")],
      variants: [],
    },
    {
      name: "Audiobook — Neon Tides, le roman audio",
      seller: "aurora",
      category: "audiobooks",
      type: "DIGITAL",
      price: 5000,
      description:
        "L'histoire de l'album Neon Tides racontée par le groupe, en 8 chapitres audio.",
      digitalStorageKey: "demo-audiobook-neon-tides.mp3",
      images: [THUMB("pexels-yankrukov-9005465.jpg")],
      variants: [],
    },
    {
      name: "T-shirt Aurora Waves",
      seller: "aurora",
      category: "vetements",
      type: "PHYSICAL",
      price: 7500,
      stock: 40,
      description:
        "Le t-shirt officiel de la tournée — coton bio, sérigraphie premium. Coupe unisexe.",
      images: [
        THUMB("pexels-yasinaydin-14984551.jpg"),
        THUMB("pexels-mart-production-7271800.jpg"),
      ],
      variants: [
        { name: "S", sku: "TSH-AUR-S", stock: 10 },
        { name: "M", sku: "TSH-AUR-M", stock: 15 },
        { name: "L", sku: "TSH-AUR-L", stock: 10 },
        { name: "XL", sku: "TSH-AUR-XL", stock: 5 },
      ],
    },
    {
      name: "Bracelet Brut — édition limitée",
      seller: "aurora",
      category: "bijoux",
      type: "PHYSICAL",
      price: 12000,
      stock: 12,
      description:
        "Bracelet homme en acier brossé, gravé du phénix Phoenix. Édition limitée à 50 exemplaires.",
      images: [THUMB("pexels-tolgaaslanturk-10781266.jpg")],
      variants: [
        { name: "19 cm", sku: "BRC-19", stock: 6 },
        { name: "21 cm", sku: "BRC-21", stock: 6 },
      ],
    },
    {
      name: "Sneakers Phoenix Rise",
      seller: "aurora",
      category: "chaussures",
      type: "PHYSICAL",
      price: 28000,
      stock: 20,
      description:
        "La sneaker collab du label : mesh respirant, semelle amortissante, dégradé violet-rose.",
      images: [THUMB("istockphoto-486420378-612x612.jpg")],
      variants: [
        { name: "40", sku: "SNK-40", stock: 5 },
        { name: "41", sku: "SNK-41", stock: 5 },
        { name: "42", sku: "SNK-42", stock: 6 },
        { name: "43", sku: "SNK-43", stock: 4 },
      ],
    },
    {
      name: "Affiche concert signée (merch)",
      seller: "aurora",
      category: "merch",
      type: "PHYSICAL",
      price: 9000,
      stock: 25,
      description:
        "Affiche A3 du concert live, signée à la main par les membres du groupe.",
      images: [THUMB("istockphoto-1324561072-612x612.jpg")],
      variants: [],
    },
    {
      name: "E-book — Recettes de tournée",
      seller: "celeste",
      category: "livres",
      type: "DIGITAL",
      price: 2000,
      description:
        "Les recettes préférées des artistes en tournée, illustrées par Celeste Moreau.",
      digitalStorageKey: "demo-ebook-recettes.pdf",
      downloadLimit: 3,
      images: [THUMB("istockphoto-1053940970-612x612.jpg")],
      variants: [],
    },
    {
      name: "Audiobook — Lettres à Paris (audio)",
      seller: "celeste",
      category: "audiobooks",
      type: "DIGITAL",
      price: 4500,
      description:
        "Les Lettres Vol. 1 lues par Celeste Moreau, avec improvisations au piano.",
      digitalStorageKey: "demo-audiobook-lettres.mp3",
      images: [THUMB("pexels-delot-19181684.jpg")],
      variants: [],
    },
    {
      name: "Casquette Phoenix brodée",
      seller: "aurora",
      category: "merch",
      type: "PHYSICAL",
      price: 5000,
      stock: 35,
      description:
        "Casquette ajustable, broderie phénix 3D, disponible en noir et violet.",
      images: [THUMB("pexels-maorattias-5152572.jpg")],
      variants: [
        { name: "Noir", sku: "CAP-BLK", stock: 20 },
        { name: "Violet", sku: "CAP-VLT", stock: 15 },
      ],
    },
    {
      name: "Ensemble bijoux Aurore",
      seller: "nadia",
      category: "bijoux",
      type: "PHYSICAL",
      price: 18000,
      stock: 8,
      description:
        "Collier + bracelet assortis, perles de verre recyclé façonnées à Grand-Bassam.",
      images: [
        THUMB("pexels-tolgaaslanturk-10781266.jpg"),
        THUMB("istockphoto-535403859-612x612.jpg"),
      ],
      variants: [
        { name: "Doré", sku: "BIJ-AUR-OR", stock: 4 },
        { name: "Argenté", sku: "BIJ-AUR-AG", stock: 4 },
      ],
    },
    {
      name: "Bottines scène — édition tournée",
      seller: "sahel",
      category: "chaussures",
      type: "PHYSICAL",
      price: 35000,
      stock: 10,
      description:
        "Bottines en cuir grainé portées sur la tournée Harmattan. Numérotées.",
      images: [THUMB("istockphoto-622215586-612x612.jpg")],
      variants: [
        { name: "40", sku: "BT-HAR-40", stock: 2 },
        { name: "41", sku: "BT-HAR-41", stock: 3 },
        { name: "42", sku: "BT-HAR-42", stock: 3 },
        { name: "43", sku: "BT-HAR-43", stock: 2 },
      ],
    },
    {
      name: "Vinyle 33T — Tidal Memory",
      seller: "aurora",
      category: "merch",
      type: "PHYSICAL",
      price: 15000,
      stock: 30,
      description:
        "Vinyle pressé en édition collector, pochette gateway avec livret de 12 pages.",
      images: [
        THUMB("pexels-delot-19181684.jpg"),
        THUMB("istockphoto-1324561072-612x612.jpg"),
      ],
      variants: [],
    },
  ];

  let created = 0;
  for (const product of products) {
    const sellerId = createdArtists.get(product.seller)!;
    const existing = await prisma.product.findFirst({
      where: { name: product.name, sellerId },
      select: { id: true },
    });
    if (existing) {
      // Refresh mutable fields + image URLs so re-seeds pick up new storage locations.
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          description: product.description,
          price: product.price,
          stock: product.type === "PHYSICAL" ? (product.stock ?? null) : null,
          images: {
            deleteMany: {},
            create: product.images.map((url, position) => ({ url, position })),
          },
        },
      });
      continue;
    }

    await prisma.product.create({
      data: {
        sellerId,
        categoryId: categoryIds.get(product.category)!,
        name: product.name,
        description: product.description,
        type: product.type,
        price: product.price,
        stock: product.type === "PHYSICAL" ? (product.stock ?? null) : null,
        digitalStorageKey:
          product.type === "DIGITAL"
            ? (product.digitalStorageKey ?? null)
            : null,
        downloadLimit:
          product.type === "DIGITAL" ? (product.downloadLimit ?? null) : null,
        images: {
          create: product.images.map((url, position) => ({ url, position })),
        },
        ...(product.variants.length > 0
          ? {
              variants: {
                create: product.variants,
              },
            }
          : {}),
      },
    });
    created += 1;
  }
  console.log(
    `  boutique products: ${created} created (${products.length} total)`,
  );
}

// ---------------------------------------------------------------------------
// Prayer space catalog
// ---------------------------------------------------------------------------

async function seedPrayerCategories() {
  const categories = [
    {
      name: "Gratitude",
      slug: "gratitude",
      description: "Louanges et remerciements.",
      sortOrder: 1,
    },
    {
      name: "Guérison",
      slug: "guerison",
      description: "Prières pour les malades.",
      sortOrder: 2,
    },
    {
      name: "Famille",
      slug: "famille",
      description: "Foyers, couples et enfants.",
      sortOrder: 3,
    },
    {
      name: "Protection",
      slug: "protection",
      description: "Voyages, travail, quotidien.",
      sortOrder: 4,
    },
    {
      name: "Louange",
      slug: "louange",
      description: "Adoration et célébration.",
      sortOrder: 5,
    },
    {
      name: "Intercession",
      slug: "intercession",
      description: "Prier les uns pour les autres.",
      sortOrder: 6,
    },
  ];
  for (const category of categories) {
    await prisma.prayerCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: category,
    });
  }
  console.log(`  prayer categories: ${categories.length} ready`);
}

// ---------------------------------------------------------------------------
// Advertising placements
// ---------------------------------------------------------------------------

async function seedAdPlacements() {
  const placements = [
    {
      key: "home_banner",
      name: "Bannière accueil",
      description: "Bannière en haut du fil d'accueil.",
    },
    {
      key: "player_audio",
      name: "Lecteur audio",
      description: "Encart sous le lecteur de musique.",
    },
    {
      key: "video_preroll",
      name: "Pré-roll vidéo",
      description: "Publicité avant la lecture vidéo.",
    },
    {
      key: "library_card",
      name: "Carte bibliothèque",
      description: "Carte dans l'onglet bibliothèque.",
    },
    {
      key: "boutique_banner",
      name: "Bannière boutique",
      description: "Bannière en tête de la boutique.",
    },
  ];
  for (const placement of placements) {
    await prisma.adPlacement.upsert({
      where: { key: placement.key },
      update: { name: placement.name, description: placement.description },
      create: placement,
    });
  }
  console.log(`  ad placements: ${placements.length} ready`);
}

// ---------------------------------------------------------------------------
// Test-user world: >= 10 rows of every user-scoped entity for
// user@gmail.com (wiped & recreated on every seed run).
// ---------------------------------------------------------------------------

const daysAgo = (d: number, hours = 0) =>
  new Date(Date.now() - d * 86_400_000 - hours * 3_600_000);
const daysAhead = (d: number) => new Date(Date.now() + d * 86_400_000);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
const startOfMonth = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

async function seedTestUserWorld(ctx: {
  listenerId: string;
  createdArtists: Map<string, string>;
}) {
  const { listenerId, createdArtists } = ctx;

  // Friend accounts for conversations, groups and calls.
  const friendIds: Record<string, string> = {};
  for (const friend of FRIENDS) {
    friendIds[friend.email.split("@")[0]!] = await ensureDemoUser({
      email: friend.email,
      name: friend.name,
      role: "USER",
    });
  }

  // -- reset every user-scoped row of the demo accounts ----------------------
  const seedUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: "@phoenix.local" } },
        { email: { in: [CANONICAL_LISTENER_EMAIL, CANONICAL_ARTIST_EMAIL] } },
      ],
    },
    select: { id: true },
  });
  const seedUserIds = seedUsers.map((u) => u.id);
  const seedArtistIds = [...createdArtists.values()];

  const myAdvertisers = await prisma.advertiser.findMany({
    where: { userId: { in: seedUserIds } },
    select: { id: true },
  });
  await prisma.adEvent.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.adCampaign.deleteMany({
    where: { advertiserId: { in: myAdvertisers.map((a) => a.id) } },
  });
  await prisma.advertiser.deleteMany({
    where: { id: { in: myAdvertisers.map((a) => a.id) } },
  });
  await prisma.sheetMusicJob.deleteMany({
    where: { userId: { in: seedUserIds } },
  }); // cascades results
  await prisma.sermon.deleteMany({ where: { authorId: { in: seedUserIds } } });
  await prisma.prayerFavorite.deleteMany({
    where: { userId: { in: seedUserIds } },
  });
  await prisma.prayer.deleteMany({ where: { authorId: { in: seedUserIds } } });
  await prisma.paymentTransaction.deleteMany({
    where: { userId: { in: seedUserIds } },
  }); // cascades receipts
  await prisma.walletTransaction.deleteMany({
    where: { wallet: { userId: { in: seedUserIds } } },
  });
  await prisma.wallet.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.order.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.cart.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.call.deleteMany({
    where: {
      OR: [
        { callerId: { in: seedUserIds } },
        { recipientId: { in: seedUserIds } },
      ],
    },
  });
  const touchedConversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: { in: seedUserIds } } } },
    select: { id: true, participants: { select: { userId: true } } },
  });
  const fullySeedConversations = touchedConversations
    .filter((c) => c.participants.every((p) => seedUserIds.includes(p.userId)))
    .map((c) => c.id);
  await prisma.message.deleteMany({
    where: { conversationId: { in: fullySeedConversations } },
  });
  await prisma.conversationParticipant.deleteMany({
    where: { userId: { in: seedUserIds } },
  });
  await prisma.conversation.deleteMany({
    where: { id: { in: fullySeedConversations } },
  });
  await prisma.pushToken.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.playbackEvent.deleteMany({
    where: { userId: { in: seedUserIds } },
  });
  await prisma.downloadRoyalty.deleteMany({
    where: {
      OR: [
        { userId: { in: seedUserIds } },
        { artistId: { in: seedArtistIds } },
      ],
    },
  });
  await prisma.download.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.playlist.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.favorite.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.artistFollow.deleteMany({
    where: { userId: { in: seedUserIds } },
  });
  await prisma.pageSubscription.deleteMany({
    where: { userId: { in: seedUserIds } },
  });
  await prisma.activityLog.deleteMany({
    where: { action: { startsWith: "seed:" } },
  });

  // -- lookups used across the world ----------------------------------------
  const songs = await prisma.song.findMany({
    select: { id: true, title: true, artistId: true, fileSizeBytes: true },
    orderBy: { publishedAt: "asc" },
  });
  const videos = await prisma.video.findMany({
    select: { id: true, title: true, artistId: true },
    orderBy: { publishedAt: "asc" },
  });
  await seedFanLibrary(listenerId, createdArtists, songs, videos);
  await seedSocial(listenerId, friendIds, createdArtists);
  await seedCommerce(listenerId, songs);
  await seedPrayerWorld(listenerId, friendIds);
  await seedTooling(listenerId, songs);
  await seedAdvertising(listenerId, friendIds);
  await seedWalletWorld(listenerId, friendIds);

  console.log(`  test-user world: ready for ${LISTENER_EMAIL}`);
}

/** Follows, subscriptions, favorites, playlists, downloads, playback events. */
async function seedFanLibrary(
  listenerId: string,
  createdArtists: Map<string, string>,
  songs: Array<{
    id: string;
    title: string;
    artistId: string;
    fileSizeBytes: number | null;
  }>,
  videos: Array<{ id: string; title: string; artistId: string }>,
) {
  const artistList = [...createdArtists.entries()];

  // Follows: the test user follows all artists.
  for (const [i, [, artistId]] of artistList.entries()) {
    await prisma.artistFollow.create({
      data: { userId: listenerId, artistId, createdAt: daysAgo(50 - i * 3) },
    });
  }

  // Page subscriptions: 8 active, 1 cancelled, 1 expired.
  const subPlan = [
    { status: "ACTIVE", offset: 0 },
    { status: "ACTIVE", offset: 1 },
    { status: "ACTIVE", offset: 2 },
    { status: "ACTIVE", offset: 3 },
    { status: "ACTIVE", offset: 4 },
    { status: "ACTIVE", offset: 5 },
    { status: "ACTIVE", offset: 6 },
    { status: "ACTIVE", offset: 7 },
    { status: "CANCELLED", offset: 8 },
    { status: "EXPIRED", offset: 9 },
  ] as const;
  for (const [i, plan] of subPlan.entries()) {
    const artistId = artistList[i]![1];
    const periodStart = plan.status === "EXPIRED" ? daysAgo(70) : daysAgo(10);
    const periodEnd = plan.status === "EXPIRED" ? daysAgo(10) : daysAhead(20);
    await prisma.pageSubscription.create({
      data: {
        userId: listenerId,
        artistId,
        monthlyAmount: 2500,
        currency: "XOF",
        status: plan.status,
        autoRenew: plan.status === "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelledAt: plan.status === "CANCELLED" ? daysAgo(3) : null,
        createdAt: daysAgo(60 - i * 4),
      },
    });
  }

  // Favorites: 12 songs + 6 videos.
  for (const [i, song] of songs.slice(0, 12).entries()) {
    await prisma.favorite.create({
      data: {
        userId: listenerId,
        songId: song.id,
        createdAt: daysAgo(40 - i * 2),
      },
    });
  }
  for (const [i, video] of videos.slice(0, 6).entries()) {
    await prisma.favorite.create({
      data: {
        userId: listenerId,
        videoId: video.id,
        createdAt: daysAgo(30 - i * 3),
      },
    });
  }

  // Playlists: 10, each with 3-5 songs (~40 playlist items).
  const playlistSpecs = [
    {
      name: "Matin d'adoration",
      isPublic: true,
      description: "Commencer la journée en douceur.",
    },
    {
      name: "Trajet bureau",
      isPublic: false,
      description: "Afrobeat & coupé pour les embouteillages.",
    },
    {
      name: "Focus profond",
      isPublic: false,
      description: "Ambient et piano pour coder.",
    },
    {
      name: "Soirée entre amis",
      isPublic: true,
      description: "Les titres qui mettent le feu.",
    },
    { name: "Mélancolie doux", isPublic: false, description: null },
    {
      name: "Sport & running",
      isPublic: false,
      description: "Cardio non-stop.",
    },
    {
      name: "Découvertes",
      isPublic: false,
      description: "Nouveautés du catalogue.",
    },
    {
      name: "Zouglou classique",
      isPublic: false,
      description: "Les anciens, les vrais.",
    },
    { name: "Kora & calme", isPublic: false, description: null },
    {
      name: "Veillée de prière",
      isPublic: false,
      description: "Fond sonore des nuits de prière.",
    },
  ];
  for (const [i, spec] of playlistSpecs.entries()) {
    const picks = songs.slice(i * 2, i * 2 + 3 + (i % 3)).map((s) => s.id);
    await prisma.playlist.create({
      data: {
        userId: listenerId,
        name: spec.name,
        description: spec.description,
        isPublic: spec.isPublic,
        createdAt: daysAgo(45 - i * 3),
        items: {
          create: picks.map((songId, position) => ({
            songId,
            position,
            addedAt: daysAgo(40 - i * 3),
          })),
        },
      },
    });
  }

  // Downloads: 12 songs + 4 videos, each accruing a 1 XOF monthly royalty.
  for (const [i, song] of songs.slice(0, 12).entries()) {
    const createdAt = daysAgo(28 - i);
    const download = await prisma.download.create({
      data: {
        userId: listenerId,
        songId: song.id,
        status: "COMPLETED",
        fileSizeBytes: song.fileSizeBytes ?? 4_800_000 + i * 120_000,
        createdAt,
        completedAt: createdAt,
      },
    });
    await prisma.downloadRoyalty.create({
      data: {
        downloadId: download.id,
        artistId: song.artistId,
        userId: listenerId,
        periodStart: startOfMonth(createdAt),
        amount: 1,
        currency: "XOF",
        createdAt,
      },
    });
  }
  for (const [i, video] of videos.slice(0, 4).entries()) {
    const createdAt = daysAgo(20 - i);
    const download = await prisma.download.create({
      data: {
        userId: listenerId,
        videoId: video.id,
        status: "COMPLETED",
        fileSizeBytes: 58_000_000 + i * 4_500_000,
        createdAt,
        completedAt: createdAt,
      },
    });
    await prisma.downloadRoyalty.create({
      data: {
        downloadId: download.id,
        artistId: video.artistId,
        userId: listenerId,
        periodStart: startOfMonth(createdAt),
        amount: 1,
        currency: "XOF",
        createdAt,
      },
    });
  }

  // One in-flight download to exercise the progress UI.
  await prisma.download.create({
    data: {
      userId: listenerId,
      videoId: videos[5]!.id,
      status: "IN_PROGRESS",
      createdAt: minutesAgo(3),
    },
  });

  // Playback events: plays, views and download events over the last 30 days.
  let eventSeq = 0;
  for (const [i, song] of songs.slice(0, 10).entries()) {
    for (let repeat = 0; repeat < 2 + (i % 3); repeat += 1) {
      eventSeq += 1;
      await prisma.playbackEvent.create({
        data: {
          clientEventId: `seed-pe-song-${eventSeq}`,
          userId: listenerId,
          eventType: "PLAY",
          songId: song.id,
          occurredAt: daysAgo(30 - i * 2, repeat * 5),
        },
      });
    }
  }
  for (const [i, video] of videos.slice(0, 6).entries()) {
    eventSeq += 1;
    await prisma.playbackEvent.create({
      data: {
        clientEventId: `seed-pe-video-${eventSeq}`,
        userId: listenerId,
        eventType: "VIEW",
        videoId: video.id,
        occurredAt: daysAgo(24 - i * 3),
      },
    });
  }
  for (const [i, song] of songs.slice(0, 4).entries()) {
    eventSeq += 1;
    await prisma.playbackEvent.create({
      data: {
        clientEventId: `seed-pe-dl-${eventSeq}`,
        userId: listenerId,
        eventType: "DOWNLOAD",
        songId: song.id,
        occurredAt: daysAgo(18 - i * 2),
      },
    });
  }

  console.log(
    "    fan library: follows, subscriptions, favorites, playlists, downloads, events",
  );
}

/** Conversations, messages, attachments, calls, push tokens. */
async function seedSocial(
  listenerId: string,
  friendIds: Record<string, string>,
  createdArtists: Map<string, string>,
) {
  const artistUserByEmail = await prisma.user.findMany({
    where: {
      role: "ARTIST",
      OR: [
        { email: { endsWith: "@phoenix.local" } },
        { email: CANONICAL_ARTIST_EMAIL },
      ],
    },
    select: { id: true, email: true },
  });
  const creatorEmail = (key: string) =>
    key === "aurora" ? CANONICAL_ARTIST_EMAIL : `${key}@phoenix.local`;
  const artistUserId = (key: string) =>
    artistUserByEmail.find((u) => u.email === creatorEmail(key))?.id ??
    listenerId;

  type Draft = {
    key: string;
    type: "DIRECT" | "GROUP";
    members: string[];
    unread: boolean;
    messages: Array<{
      senderId: string;
      type: "TEXT" | "VOICE" | "IMAGE" | "FILE";
      content: string | null;
      minutes: number;
      attachment?: {
        url: string;
        storageKey: string;
        mimeType: string;
        durationSec?: number;
        name?: string;
        size: number;
      };
    }>;
  };

  const marie = friendIds["marie"]!;
  const david = friendIds["david"]!;
  const grace = friendIds["grace"]!;
  const imran = friendIds["imran"]!;

  const drafts: Draft[] = [
    {
      key: "aurora",
      type: "DIRECT",
      members: [listenerId, artistUserId("aurora")],
      unread: true,
      messages: [
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Salut ! Neon Tides en boucle depuis lundi, quel morceau 🙌",
          minutes: 60 * 26,
        },
        {
          senderId: artistUserId("aurora"),
          type: "TEXT",
          content: "Merci Nina ! L'album complet arrive le mois prochain.",
          minutes: 60 * 25,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Hâte de l'écouter. Vous jouez à Abidjan bientôt ?",
          minutes: 60 * 24,
        },
        {
          senderId: listenerId,
          type: "IMAGE",
          content: null,
          minutes: 60 * 23,
          attachment: {
            url: "/uploads/seed/concert-aurora.jpg",
            storageKey: "seed/concert-aurora.jpg",
            mimeType: "image/jpeg",
            name: "concert-aurora.jpg",
            size: 512_000,
          },
        },
        {
          senderId: artistUserId("aurora"),
          type: "TEXT",
          content: "Superbe photo ! On la met sur la page de la tournée ?",
          minutes: 60 * 22,
        },
      ],
    },
    {
      key: "celeste",
      type: "DIRECT",
      members: [listenerId, artistUserId("celeste")],
      unread: false,
      messages: [
        {
          senderId: artistUserId("celeste"),
          type: "TEXT",
          content: "Nina, la partition de Nocturne No. 3 est prête.",
          minutes: 60 * 50,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Trop contente, je la télécharge ce soir !",
          minutes: 60 * 49,
        },
        {
          senderId: artistUserId("celeste"),
          type: "TEXT",
          content:
            "Dites-moi comment la main gauche se place, je peux enregistrer un mémo.",
          minutes: 60 * 48,
        },
        {
          senderId: listenerId,
          type: "VOICE",
          content: null,
          minutes: 60 * 47,
          attachment: {
            url: "/uploads/seed/voice-celeste.m4a",
            storageKey: "seed/voice-celeste.m4a",
            mimeType: "audio/mp4",
            durationSec: 22,
            size: 330_000,
          },
        },
        {
          senderId: artistUserId("celeste"),
          type: "VOICE",
          content: null,
          minutes: 60 * 46,
          attachment: {
            url: "/uploads/seed/voice-celeste-rep.m4a",
            storageKey: "seed/voice-celeste-rep.m4a",
            mimeType: "audio/mp4",
            durationSec: 35,
            size: 520_000,
          },
        },
      ],
    },
    {
      key: "marie",
      type: "DIRECT",
      members: [listenerId, marie],
      unread: true,
      messages: [
        {
          senderId: marie,
          type: "TEXT",
          content: "Tu as vu le nouveau clip de Mfoni ?",
          minutes: 200,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Pas encore, je le regarde à la pause !",
          minutes: 180,
        },
        {
          senderId: marie,
          type: "IMAGE",
          content: null,
          minutes: 170,
          attachment: {
            url: "/uploads/seed/mfoni-clip.jpg",
            storageKey: "seed/mfoni-clip.jpg",
            mimeType: "image/jpeg",
            name: "mfoni-clip.jpg",
            size: 248_000,
          },
        },
        {
          senderId: listenerId,
          type: "VOICE",
          content: null,
          minutes: 160,
          attachment: {
            url: "/uploads/seed/voice-marie.m4a",
            storageKey: "seed/voice-marie.m4a",
            mimeType: "audio/mp4",
            durationSec: 14,
            size: 210_000,
          },
        },
      ],
    },
    {
      key: "david",
      type: "DIRECT",
      members: [listenerId, david],
      unread: false,
      messages: [
        {
          senderId: david,
          type: "TEXT",
          content: "La playlist Matin d'adoration est parfaite pour le trajet.",
          minutes: 60 * 30,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Merci ! Je te partage la mise à jour de ce week-end.",
          minutes: 60 * 29,
        },
        {
          senderId: listenerId,
          type: "VOICE",
          content: null,
          minutes: 60 * 28,
          attachment: {
            url: "/uploads/seed/voice-david.m4a",
            storageKey: "seed/voice-david.m4a",
            mimeType: "audio/mp4",
            durationSec: 11,
            size: 165_000,
          },
        },
        {
          senderId: david,
          type: "VOICE",
          content: null,
          minutes: 60 * 27,
          attachment: {
            url: "/uploads/seed/voice-david-rep.m4a",
            storageKey: "seed/voice-david-rep.m4a",
            mimeType: "audio/mp4",
            durationSec: 18,
            size: 270_000,
          },
        },
      ],
    },
    {
      key: "grace",
      type: "DIRECT",
      members: [listenerId, grace],
      unread: false,
      messages: [
        {
          senderId: grace,
          type: "TEXT",
          content: "On se retrouve à la veillée de vendredi ?",
          minutes: 60 * 70,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Oui ! J'amène la playlist Veillée de prière 🙏",
          minutes: 60 * 68,
        },
        {
          senderId: listenerId,
          type: "IMAGE",
          content: null,
          minutes: 60 * 67,
          attachment: {
            url: "/uploads/seed/veillee-programme.jpg",
            storageKey: "seed/veillee-programme.jpg",
            mimeType: "image/jpeg",
            name: "veillee-programme.jpg",
            size: 298_000,
          },
        },
      ],
    },
    {
      key: "imran",
      type: "DIRECT",
      members: [listenerId, imran],
      unread: false,
      messages: [
        {
          senderId: imran,
          type: "TEXT",
          content:
            "J'ai payé la facture d'électricité via l'app, c'est instantané.",
          minutes: 60 * 96,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Top, je teste pour la mienne aujourd'hui.",
          minutes: 60 * 95,
        },
        {
          senderId: listenerId,
          type: "FILE",
          content: null,
          minutes: 60 * 94,
          attachment: {
            url: "/uploads/seed/facture-eau.pdf",
            storageKey: "seed/facture-eau.pdf",
            mimeType: "application/pdf",
            name: "facture-eau.pdf",
            size: 88_000,
          },
        },
      ],
    },
    {
      key: "solaris",
      type: "DIRECT",
      members: [listenerId, artistUserId("solaris")],
      unread: true,
      messages: [
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Golden Hour en concert, c'était énorme samedi !",
          minutes: 90,
        },
        {
          senderId: artistUserId("solaris"),
          type: "TEXT",
          content:
            "Merci d'être venue ! Les places de la prochaine tournée bientôt en boutique.",
          minutes: 60,
        },
        {
          senderId: listenerId,
          type: "IMAGE",
          content: null,
          minutes: 55,
          attachment: {
            url: "/uploads/seed/fos-concert-solaris.jpg",
            storageKey: "seed/fos-concert-solaris.jpg",
            mimeType: "image/jpeg",
            name: "concert-solaris.jpg",
            size: 486_000,
          },
        },
      ],
    },
    {
      key: "kaya",
      type: "DIRECT",
      members: [listenerId, artistUserId("kaya")],
      unread: false,
      messages: [
        {
          senderId: artistUserId("kaya"),
          type: "TEXT",
          content: "Nouveau dub dispo en téléchargement, big up !",
          minutes: 60 * 120,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Déjà dans ma bibliothèque 🔥",
          minutes: 60 * 119,
        },
        {
          senderId: listenerId,
          type: "IMAGE",
          content: null,
          minutes: 60 * 118,
          attachment: {
            url: "/uploads/seed/dub-session.jpg",
            storageKey: "seed/dub-session.jpg",
            mimeType: "image/jpeg",
            name: "dub-session.jpg",
            size: 402_000,
          },
        },
      ],
    },
    {
      key: "group-studio",
      type: "GROUP",
      members: [listenerId, marie, david, artistUserId("aurora")],
      unread: false,
      messages: [
        {
          senderId: marie,
          type: "TEXT",
          content: "Bienvenue dans le groupe Studio Phoenix 🎛️",
          minutes: 60 * 40,
        },
        {
          senderId: david,
          type: "TEXT",
          content: "On y partage nos morceaux préférés de la semaine ?",
          minutes: 60 * 39,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content:
            "Avec plaisir ! Je commence : Reflections, en écoute nocturne.",
          minutes: 60 * 38,
        },
        {
          senderId: artistUserId("aurora"),
          type: "TEXT",
          content: "Bonne pioche — le remix arrive bientôt ici même.",
          minutes: 60 * 37,
        },
        {
          senderId: listenerId,
          type: "FILE",
          content: null,
          minutes: 60 * 36,
          attachment: {
            url: "/uploads/seed/notes-session.pdf",
            storageKey: "seed/notes-session.pdf",
            mimeType: "application/pdf",
            name: "notes-session.pdf",
            size: 1_240_000,
          },
        },
        {
          senderId: marie,
          type: "IMAGE",
          content: null,
          minutes: 60 * 35,
          attachment: {
            url: "/uploads/seed/session-studio.jpg",
            storageKey: "seed/session-studio.jpg",
            mimeType: "image/jpeg",
            name: "session-studio.jpg",
            size: 674_000,
          },
        },
      ],
    },
    {
      key: "group-tournee",
      type: "GROUP",
      members: [
        listenerId,
        imran,
        grace,
        artistUserId("celeste"),
        artistUserId("kaya"),
      ],
      unread: true,
      messages: [
        {
          senderId: imran,
          type: "TEXT",
          content: "Covoiturage pour le concert de samedi, qui est partant ?",
          minutes: 60 * 20,
        },
        {
          senderId: grace,
          type: "TEXT",
          content: "Moi ! Je peux prendre 3 personnes à Cocody.",
          minutes: 60 * 19,
        },
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Je suis de la partie, merci Grace 🚗",
          minutes: 60 * 18,
        },
        {
          senderId: listenerId,
          type: "VOICE",
          content: null,
          minutes: 60 * 17,
          attachment: {
            url: "/uploads/seed/voice-tournee.m4a",
            storageKey: "seed/voice-tournee.m4a",
            mimeType: "audio/mp4",
            durationSec: 9,
            size: 135_000,
          },
        },
      ],
    },
    {
      key: "group-lecture",
      type: "GROUP",
      members: [listenerId, marie, grace],
      unread: false,
      messages: [
        {
          senderId: grace,
          type: "TEXT",
          content: "Le club lecture audio se réunit jeudi 20h.",
          minutes: 60 * 60,
        },
        {
          senderId: marie,
          type: "TEXT",
          content: "J'ai fini le chapitre 3, sans spoilers mais wow.",
          minutes: 60 * 58,
        },
        {
          senderId: listenerId,
          type: "IMAGE",
          content: null,
          minutes: 60 * 57,
          attachment: {
            url: "/uploads/seed/club-lecture.jpg",
            storageKey: "seed/club-lecture.jpg",
            mimeType: "image/jpeg",
            name: "club-lecture.jpg",
            size: 351_000,
          },
        },
      ],
    },
    {
      key: "group-famille",
      type: "GROUP",
      members: [listenerId, david, imran],
      unread: false,
      messages: [
        {
          senderId: listenerId,
          type: "TEXT",
          content: "Petit rappel : cotisation du mois 🙏",
          minutes: 60 * 200,
        },
        {
          senderId: david,
          type: "TEXT",
          content: "Envoyée ce matin via Chuyassi Pay ✅",
          minutes: 60 * 199,
        },
        {
          senderId: listenerId,
          type: "FILE",
          content: null,
          minutes: 60 * 198,
          attachment: {
            url: "/uploads/seed/cotisations.pdf",
            storageKey: "seed/cotisations.pdf",
            mimeType: "application/pdf",
            name: "cotisations.pdf",
            size: 64_000,
          },
        },
      ],
    },
  ];

  const placementByConv: Record<string, string> = {};
  for (const draft of drafts) {
    const conversation = await prisma.conversation.create({
      data: {
        type: draft.type,
        participants: {
          create: draft.members.map((userId) => ({
            userId,
            lastReadAt:
              draft.unread && userId === listenerId
                ? minutesAgo(draft.messages[0]!.minutes + 5)
                : new Date(),
          })),
        },
        messages: {
          create: draft.messages.map((message) => ({
            senderId: message.senderId,
            type: message.type,
            content: message.content,
            createdAt: minutesAgo(message.minutes),
            ...(message.attachment
              ? {
                  attachment: {
                    create: {
                      url: resolveAssetUrl(message.attachment.url),
                      storageKey: message.attachment.storageKey,
                      mimeType: message.attachment.mimeType,
                      fileSizeBytes: message.attachment.size,
                      durationSec: message.attachment.durationSec ?? null,
                      name: message.attachment.name ?? null,
                    },
                  },
                }
              : {}),
          })),
        },
      },
      select: { id: true },
    });
    placementByConv[draft.key] = conversation.id;
  }

  // Calls: ended, missed, rejected and one still ringing.
  const callSpecs = [
    {
      other: "marie",
      caller: true,
      type: "AUDIO",
      status: "ENDED",
      day: 14,
      duration: 412,
    },
    {
      other: "david",
      caller: false,
      type: "AUDIO",
      status: "ENDED",
      day: 12,
      duration: 95,
    },
    {
      other: "grace",
      caller: true,
      type: "VIDEO",
      status: "ENDED",
      day: 10,
      duration: 1_805,
    },
    {
      other: "imran",
      caller: false,
      type: "AUDIO",
      status: "MISSED",
      day: 9,
      duration: null,
    },
    {
      other: "marie",
      caller: false,
      type: "VIDEO",
      status: "ENDED",
      day: 7,
      duration: 623,
    },
    {
      other: "david",
      caller: true,
      type: "AUDIO",
      status: "REJECTED",
      day: 6,
      duration: null,
    },
    {
      other: "grace",
      caller: true,
      type: "AUDIO",
      status: "ENDED",
      day: 4,
      duration: 148,
    },
    {
      other: "imran",
      caller: false,
      type: "AUDIO",
      status: "ENDED",
      day: 3,
      duration: 1_022,
    },
    {
      other: "marie",
      caller: true,
      type: "AUDIO",
      status: "MISSED",
      day: 2,
      duration: null,
    },
    {
      other: "david",
      caller: false,
      type: "VIDEO",
      status: "ENDED",
      day: 1,
      duration: 337,
    },
  ] as const;
  for (const spec of callSpecs) {
    const otherId = friendIds[spec.other]!;
    const callerId = spec.caller ? listenerId : otherId;
    const recipientId = spec.caller ? otherId : listenerId;
    const startedAt = daysAgo(spec.day, 2);
    const answeredAt =
      spec.status === "ENDED" ? new Date(startedAt.getTime() + 8_000) : null;
    const endedAt =
      spec.status === "ENDED"
        ? new Date(startedAt.getTime() + 8_000 + (spec.duration ?? 0) * 1_000)
        : null;
    await prisma.call.create({
      data: {
        conversationId: placementByConv[spec.other] ?? null,
        callerId,
        recipientId,
        type: spec.type,
        status: spec.status,
        startedAt,
        answeredAt,
        endedAt,
        durationSec: spec.duration,
      },
    });
  }
  // A call still ringing, placed less than a minute ago.
  await prisma.call.create({
    data: {
      conversationId: placementByConv["group-studio"] ?? null,
      callerId: listenerId,
      recipientId: friendIds["grace"]!,
      type: "VIDEO",
      status: "RINGING",
      startedAt: minutesAgo(1),
    },
  });

  // Push tokens: the test user's registered devices.
  const tokenSpecs = [
    { platform: "ANDROID", deviceId: "device-pixel-7" },
    { platform: "ANDROID", deviceId: "device-samsung-a54" },
    { platform: "IOS", deviceId: "device-iphone-13" },
    { platform: "IOS", deviceId: "device-ipad-air" },
    { platform: "WEB", deviceId: "browser-chrome-desk" },
    { platform: "WEB", deviceId: "browser-firefox-lab" },
    { platform: "ANDROID", deviceId: "device-xiaomi-redmi" },
    { platform: "ANDROID", deviceId: "device-oppo-a78" },
    { platform: "IOS", deviceId: "device-iphone-se" },
    { platform: "WEB", deviceId: "browser-edge-work" },
  ] as const;
  for (const [i, spec] of tokenSpecs.entries()) {
    await prisma.pushToken.create({
      data: {
        userId: listenerId,
        token: `ExponentPushToken[seed-listener-${String(i + 1).padStart(2, "0")}]`,
        platform: spec.platform,
        deviceId: spec.deviceId,
        appVersion: i % 3 === 0 ? "1.4.0" : "1.3.2",
        createdAt: daysAgo(25 - i),
      },
    });
  }

  console.log("    social: conversations, messages, calls, push tokens");
}

/** Cart, orders, payments and receipts for the test user. */
async function seedCommerce(listenerId: string, songs: Array<{ id: string }>) {
  const products = await prisma.product.findMany({
    include: { variants: true },
  });
  const byName = (name: string) =>
    products.find((p) => p.name.startsWith(name))!;
  const services = await prisma.paymentService.findMany();
  const serviceByName = (name: string) =>
    services.find((s) => s.name.startsWith(name))!;

  // Cart: 10 items across products and variants.
  await prisma.cart.create({
    data: {
      userId: listenerId,
      items: {
        create: [
          {
            productId: byName("T-shirt Aurora").id,
            variantId: byName("T-shirt Aurora").variants[1]?.id,
            quantity: 1,
          },
          {
            productId: byName("Bracelet Brut").id,
            variantId: byName("Bracelet Brut").variants[1]?.id,
            quantity: 1,
          },
          {
            productId: byName("Sneakers Phoenix").id,
            variantId: byName("Sneakers Phoenix").variants[2]?.id,
            quantity: 1,
          },
          {
            productId: byName("Casquette Phoenix").id,
            variantId: byName("Casquette Phoenix").variants[0]?.id,
            quantity: 2,
          },
          {
            productId: byName("Ensemble bijoux").id,
            variantId: byName("Ensemble bijoux").variants[0]?.id,
            quantity: 1,
          },
          {
            productId: byName("Bottines scène").id,
            variantId: byName("Bottines scène").variants[1]?.id,
            quantity: 1,
          },
          { productId: byName("Vinyle 33T").id, quantity: 1 },
          { productId: byName("Affiche concert").id, quantity: 2 },
          { productId: byName("Livre numérique — Mémoires").id, quantity: 1 },
          { productId: byName("Audiobook — Lettres").id, quantity: 1 },
        ],
      },
    },
  });

  const citySpecs = [
    {
      city: "Abidjan",
      area: "Cocody Angré",
      line: "Rue des Jardins, villa 12",
      phone: "+225 07 07 12 34 56",
    },
    {
      city: "Abidjan",
      area: "Marcory Zone 4",
      line: "Boulevard VGE, rés. Eburnie",
      phone: "+225 07 07 12 34 56",
    },
    {
      city: "Bouaké",
      area: "Air France",
      line: "Quartier Air France, lot 88",
      phone: "+225 05 05 98 76 54",
    },
    {
      city: "Yamoussoukro",
      area: "Habitat",
      line: "Cité administrative, bât. C",
      phone: "+225 01 01 45 67 89",
    },
  ];

  // Orders: covers every OrderStatus, physical + digital, addresses on physical.
  const orderSpecs: Array<{
    status:
      | "PENDING"
      | "AWAITING_PAYMENT"
      | "PAID"
      | "PROCESSING"
      | "SHIPPED"
      | "DELIVERED"
      | "CANCELLED"
      | "REFUNDED";
    day: number;
    items: Array<{
      product: string;
      variantIndex?: number;
      quantity: number;
      downloaded?: number;
    }>;
    withAddress: boolean;
    cityIndex?: number;
    paid: boolean;
  }> = [
    {
      status: "DELIVERED",
      day: 58,
      items: [
        { product: "T-shirt Aurora", variantIndex: 1, quantity: 1 },
        { product: "Affiche concert", quantity: 1 },
      ],
      withAddress: true,
      cityIndex: 0,
      paid: true,
    },
    {
      status: "DELIVERED",
      day: 41,
      items: [
        { product: "Livre numérique — Mémoires", quantity: 1, downloaded: 2 },
      ],
      withAddress: false,
      paid: true,
    },
    {
      status: "DELIVERED",
      day: 27,
      items: [{ product: "Vinyle 33T", quantity: 1 }],
      withAddress: true,
      cityIndex: 1,
      paid: true,
    },
    {
      status: "SHIPPED",
      day: 12,
      items: [{ product: "Sneakers Phoenix", variantIndex: 2, quantity: 1 }],
      withAddress: true,
      cityIndex: 0,
      paid: true,
    },
    {
      status: "SHIPPED",
      day: 9,
      items: [
        { product: "Casquette Phoenix", variantIndex: 1, quantity: 1 },
        { product: "Audiobook — Neon Tides", quantity: 1, downloaded: 1 },
      ],
      withAddress: true,
      cityIndex: 2,
      paid: true,
    },
    {
      status: "PROCESSING",
      day: 6,
      items: [{ product: "Bracelet Brut", variantIndex: 0, quantity: 1 }],
      withAddress: true,
      cityIndex: 1,
      paid: true,
    },
    {
      status: "PROCESSING",
      day: 5,
      items: [{ product: "E-book — Recettes", quantity: 1, downloaded: 0 }],
      withAddress: false,
      paid: true,
    },
    {
      status: "PAID",
      day: 3,
      items: [{ product: "Ensemble bijoux", variantIndex: 1, quantity: 1 }],
      withAddress: true,
      cityIndex: 3,
      paid: true,
    },
    {
      status: "PAID",
      day: 2,
      items: [{ product: "Bottines scène", variantIndex: 1, quantity: 1 }],
      withAddress: true,
      cityIndex: 0,
      paid: true,
    },
    {
      status: "AWAITING_PAYMENT",
      day: 1,
      items: [{ product: "T-shirt Aurora", variantIndex: 3, quantity: 2 }],
      withAddress: true,
      cityIndex: 0,
      paid: false,
    },
    {
      status: "CANCELLED",
      day: 16,
      items: [{ product: "Affiche concert", quantity: 1 }],
      withAddress: true,
      cityIndex: 1,
      paid: false,
    },
    {
      status: "REFUNDED",
      day: 22,
      items: [{ product: "Sneakers Phoenix", variantIndex: 0, quantity: 1 }],
      withAddress: true,
      cityIndex: 2,
      paid: true,
    },
  ];

  let txSeq = 0;
  for (const [i, spec] of orderSpecs.entries()) {
    const lines = spec.items.map((item) => {
      const product = byName(item.product);
      const variant =
        item.variantIndex !== undefined
          ? product.variants[item.variantIndex]
          : undefined;
      const unitPrice = variant?.priceOverride ?? product.price;
      return {
        product,
        variant,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        downloaded: item.downloaded ?? 0,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const shippingFee = spec.withAddress ? 1_500 : 0;
    const createdAt = daysAgo(spec.day, 3);
    const order = await prisma.order.create({
      data: {
        userId: listenerId,
        reference: `PHX-SEED-CMD-${String(i + 1).padStart(3, "0")}`,
        status: spec.status,
        subtotal,
        shippingFee,
        total: subtotal + shippingFee,
        currency: "XOF",
        paidAt: spec.paid ? new Date(createdAt.getTime() + 6 * 60_000) : null,
        createdAt,
        items: {
          create: lines.map((line) => ({
            productId: line.product.id,
            variantId: line.variant?.id,
            productName: line.product.name,
            variantName: line.variant?.name,
            productType: line.product.type,
            digitalStorageKey: line.product.digitalStorageKey,
            downloadLimit: line.product.downloadLimit,
            downloadCount: line.downloaded,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          })),
        },
        ...(spec.withAddress
          ? {
              address: {
                create: {
                  recipientName: "Nina Listener",
                  phone: citySpecs[spec.cityIndex ?? 0]!.phone,
                  city: citySpecs[spec.cityIndex ?? 0]!.city,
                  area: citySpecs[spec.cityIndex ?? 0]!.area,
                  addressLine: citySpecs[spec.cityIndex ?? 0]!.line,
                  instructions: i % 2 === 0 ? "Appeler avant de livrer." : null,
                },
              },
            }
          : {}),
      },
      select: { id: true, total: true, paidAt: true },
    });

    // Payment for the order (SUCCESS with receipt, PENDING while awaiting, CANCELLED if cancelled).
    if (spec.status !== "AWAITING_PAYMENT") {
      txSeq += 1;
      const txnStatus =
        spec.status === "REFUNDED"
          ? "REFUNDED"
          : spec.status === "CANCELLED"
            ? "CANCELLED"
            : "SUCCESS";
      await prisma.paymentTransaction.create({
        data: {
          userId: listenerId,
          orderId: order.id,
          reference: `PHX-SEED-TX-${String(txSeq).padStart(3, "0")}`,
          provider: "simulated",
          providerReference: `PROV-SEED-${String(txSeq).padStart(3, "0")}`,
          amount: order.total,
          currency: "XOF",
          status: txnStatus,
          metadata: {
            kind: "order",
            orderReference: `PHX-SEED-CMD-${String(i + 1).padStart(3, "0")}`,
          },
          paidAt: spec.paid ? order.paidAt : null,
          createdAt: new Date(createdAt.getTime() + 5 * 60_000),
          ...(spec.paid
            ? {
                receipt: {
                  create: {
                    reference: `PHX-SEED-RC-${String(txSeq).padStart(3, "0")}`,
                    externalReference: `EXT-SEED-${String(txSeq).padStart(3, "0")}`,
                    amount: order.total,
                    currency: "XOF",
                    method: txSeq % 2 === 0 ? "orange_money" : "wave",
                    issuedAt: order.paidAt ?? createdAt,
                  },
                },
              }
            : {}),
        },
      });
    }
  }

  // Service payments: 9 success + 1 pending + 1 failed + 1 refunded.
  const serviceSpecs = [
    {
      service: "Facture d'électricité",
      amount: 12_400,
      day: 32,
      status: "SUCCESS",
      fields: {
        customerNumber: "CI-EA-4451209",
        invoiceRef: "FCT-2026-0912",
        phone: "+225 07 07 12 34 56",
      },
    },
    {
      service: "Facture d'eau",
      amount: 6_800,
      day: 30,
      status: "SUCCESS",
      fields: {
        customerNumber: "CI-WA-88231",
        invoiceRef: "EAU-2026-4471",
        phone: "+225 07 07 12 34 56",
      },
    },
    {
      service: "Frais de scolarité — Lycée",
      amount: 85_000,
      day: 27,
      status: "SUCCESS",
      fields: {
        studentName: "Yao Listener",
        school: "Lycée Moderne de Cocody",
        matricule: "MTR-2026-1180",
        class: "2nde A",
        phone: "+225 07 07 12 34 56",
      },
    },
    {
      service: "Extrait d'acte de naissance",
      amount: 1_500,
      day: 24,
      status: "SUCCESS",
      fields: {
        fullName: "Nina Listener",
        birthDate: "1994-03-21",
        birthPlace: "Abidjan",
      },
    },
    {
      service: "Certificat de résidence",
      amount: 1_000,
      day: 21,
      status: "SUCCESS",
      fields: { fullName: "Nina Listener", quarter: "Cocody Angré" },
    },
    {
      service: "Recharge TV par satellite",
      amount: 5_000,
      day: 18,
      status: "SUCCESS",
      fields: {
        decoderNumber: "DEC-778812",
        formula: "Famille",
        phone: "+225 07 07 12 34 56",
      },
    },
    {
      service: "Abonnement Internet partenaire",
      amount: 15_000,
      day: 15,
      status: "SUCCESS",
      fields: { accountNumber: "NET-55210", plan: "Mois" },
    },
    {
      service: "Billet de transport intercity",
      amount: 12_000,
      day: 11,
      status: "SUCCESS",
      fields: {
        company: "UtB",
        departure: "Abidjan",
        arrival: "Bouaké",
        travelDate: "2026-10-18",
        phone: "+225 07 07 12 34 56",
      },
    },
    {
      service: "Don à l'église / association",
      amount: 10_000,
      day: 8,
      status: "SUCCESS",
      fields: {
        organization: "Paroisse Sainte-Rita",
        donorName: "Nina Listener",
        phone: "+225 07 07 12 34 56",
      },
    },
    {
      service: "Frais universitaires",
      amount: 150_000,
      day: 4,
      status: "PENDING",
      fields: {
        studentName: "Yao Listener",
        university: "Université Félix Houphouët-Boigny",
        matricule: "UFR-2026-4410",
        phone: "+225 07 07 12 34 56",
      },
    },
    {
      service: "Facture d'électricité",
      amount: 9_350,
      day: 7,
      status: "FAILED",
      fields: {
        customerNumber: "CI-EA-4451209",
        invoiceRef: "FCT-2026-1042",
        phone: "+225 07 07 12 34 56",
      },
    },
    {
      service: "Frais d'examen officiel",
      amount: 12_000,
      day: 19,
      status: "REFUNDED",
      fields: {
        candidateName: "Yao Listener",
        examType: "BEPC",
        center: "Cocody",
        phone: "+225 07 07 12 34 56",
      },
    },
  ] as const;

  for (const spec of serviceSpecs) {
    txSeq += 1;
    const service = serviceByName(spec.service);
    const createdAt = daysAgo(spec.day, 4);
    await prisma.paymentTransaction.create({
      data: {
        userId: listenerId,
        serviceId: service.id,
        reference: `PHX-SEED-TX-${String(txSeq).padStart(3, "0")}`,
        provider: "simulated",
        providerReference:
          spec.status === "SUCCESS" || spec.status === "REFUNDED"
            ? `PROV-SEED-${String(txSeq).padStart(3, "0")}`
            : null,
        amount: spec.amount,
        currency: "XOF",
        status: spec.status,
        metadata: {
          kind: "service",
          serviceId: service.id,
          fields: spec.fields,
        },
        paidAt:
          spec.status === "SUCCESS" || spec.status === "REFUNDED"
            ? new Date(createdAt.getTime() + 2 * 60_000)
            : null,
        createdAt,
        ...(spec.status === "SUCCESS"
          ? {
              receipt: {
                create: {
                  reference: `PHX-SEED-RC-${String(txSeq).padStart(3, "0")}`,
                  externalReference: `EXT-SEED-${String(txSeq).padStart(3, "0")}`,
                  amount: spec.amount,
                  currency: "XOF",
                  method: txSeq % 3 === 0 ? "moov_money" : "orange_money",
                  issuedAt: new Date(createdAt.getTime() + 2 * 60_000),
                },
              },
            }
          : {}),
      },
    });
  }

  // Audit trail entries describing the seeded activity.
  const orders = await prisma.order.findMany({
    where: { userId: listenerId },
    select: { id: true, reference: true },
  });
  const logSpecs = [
    {
      action: "seed:order.cancelled",
      entityType: "Order",
      entityIndex: 10,
      metadata: { reason: "Client request" },
    },
    {
      action: "seed:order.refunded",
      entityType: "Order",
      entityIndex: 11,
      metadata: { reason: "Size mismatch", refundAmount: 28_000 },
    },
    {
      action: "seed:payment.failed",
      entityType: "PaymentTransaction",
      entityIndex: null,
      metadata: { providerCode: "TIMEOUT" },
    },
    {
      action: "seed:payment.refunded",
      entityType: "PaymentTransaction",
      entityIndex: null,
      metadata: { providerCode: "EXAM_CANCELLED" },
    },
    {
      action: "seed:subscription.expired",
      entityType: "PageSubscription",
      entityIndex: null,
      metadata: { artist: "Sahel Blues" },
    },
    {
      action: "seed:digital.download",
      entityType: "OrderItem",
      entityIndex: null,
      metadata: { product: "Livre numérique — Mémoires d'Aurora (PDF)" },
    },
    {
      action: "seed:digital.download",
      entityType: "OrderItem",
      entityIndex: null,
      metadata: { product: "Livre numérique — Mémoires d'Aurora (PDF)" },
    },
    {
      action: "seed:digital.download",
      entityType: "OrderItem",
      entityIndex: null,
      metadata: { product: "Audiobook — Neon Tides, le roman audio" },
    },
    {
      action: "seed:royalty.accrued",
      entityType: "Download",
      entityIndex: null,
      metadata: { amount: 1, currency: "XOF" },
    },
    {
      action: "seed:playlist.shared",
      entityType: "Playlist",
      entityIndex: null,
      metadata: { name: "Matin d'adoration" },
    },
    {
      action: "seed:call.missed",
      entityType: "Call",
      entityIndex: null,
      metadata: { from: "Imran Bakayoko" },
    },
    {
      action: "seed:push.registered",
      entityType: "PushToken",
      entityIndex: null,
      metadata: { platform: "WEB" },
    },
  ];
  for (const [i, spec] of logSpecs.entries()) {
    const entity =
      spec.entityType === "Order" && spec.entityIndex !== null
        ? orders[spec.entityIndex]
        : undefined;
    await prisma.activityLog.create({
      data: {
        actorId: listenerId,
        action: spec.action,
        entityType: spec.entityType,
        entityId: entity?.id ?? songs[i % songs.length]!.id,
        metadata: spec.metadata,
        createdAt: daysAgo(20 - i),
      },
    });
  }

  console.log("    commerce: cart, orders, payments, receipts, activity log");
}

/** Prayers, prayer favorites and sermons. */
async function seedPrayerWorld(
  listenerId: string,
  friendIds: Record<string, string>,
) {
  const categories = await prisma.prayerCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const category = (i: number) => categories[i % categories.length]!;

  // 10 prayers authored by the test user (7 published, 3 drafts).
  const myPrayers = [
    {
      title: "Gratitude pour la traversée de l'année",
      status: "PUBLISHED",
      day: 30,
      audio: false,
    },
    {
      title: "Pour la santé de ma mère",
      status: "PUBLISHED",
      day: 26,
      audio: false,
    },
    {
      title: "Voyage serein pour toute la famille",
      status: "PUBLISHED",
      day: 22,
      audio: true,
    },
    {
      title: "Discernement dans mes projets",
      status: "PUBLISHED",
      day: 18,
      audio: false,
    },
    {
      title: "Louange du matin (psaume 100)",
      status: "PUBLISHED",
      day: 14,
      audio: true,
    },
    {
      title: "Pour les étudiants en période d'examens",
      status: "PUBLISHED",
      day: 10,
      audio: false,
    },
    {
      title: "Unité dans notre quartier",
      status: "PUBLISHED",
      day: 6,
      audio: false,
    },
    {
      title: "Préparation de la veillée de vendredi (brouillon)",
      status: "DRAFT",
      day: 4,
      audio: false,
    },
    {
      title: "Intersession pour les malades de l'hôpital (brouillon)",
      status: "DRAFT",
      day: 3,
      audio: false,
    },
    {
      title: "Action de grâce personnelle (brouillon)",
      status: "DRAFT",
      day: 2,
      audio: false,
    },
  ] as const;
  const myPrayerIds: string[] = [];
  for (const [i, prayer] of myPrayers.entries()) {
    const record = await prisma.prayer.create({
      data: {
        authorId: listenerId,
        categoryId: category(i).id,
        title: prayer.title,
        content:
          "Seigneur, nous te confions ce jour nos joies et nos peurs. Fortifie notre foi, garde nos familles et fais de nous des instruments de ta paix. Que ta lumière éclaire chaque pas, aujourd'hui et toujours. Amen.",
        audioUrl: prayer.audio
          ? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
          : null,
        audioStorageKey: null,
        audioDurationSec: prayer.audio ? 214 : null,
        status: prayer.status,
        publishedAt: prayer.status === "PUBLISHED" ? daysAgo(prayer.day) : null,
        createdAt: daysAgo(prayer.day, 5),
      },
      select: { id: true },
    });
    myPrayerIds.push(record.id);
  }

  // Friends author 12 published prayers — the favorites pool of the test user.
  const friendEntries = Object.entries(friendIds);
  const friendPrayerTitles = [
    "Pour la paix dans notre pays",
    "Guérison de mon père",
    "Sagesse pour les décisions du conseil",
    "Protection des voyageurs de la route de Bouaké",
    "Action de grâce pour une naissance",
    "Pour les familles en difficulté",
    "Foi inébranlable dans l'épreuve",
    "Prière du soir en famille",
    "Pour nos leaders et nos églises",
    "Confiance pour la rentrée scolaire",
    "Consolation des cœurs brisés",
    "Joie retrouvée après la maladie",
  ];
  const friendPrayerIds: string[] = [];
  for (const [i, title] of friendPrayerTitles.entries()) {
    const authorId = friendEntries[i % friendEntries.length]![1];
    const record = await prisma.prayer.create({
      data: {
        authorId,
        categoryId: category(i + 3).id,
        title,
        content:
          "Père céleste, nous venons devant toi avec humilité. Reçois notre prière, apaise nos cœurs et réponds selon ta volonté. Nous croyons que tu entends chaque cri de notre âme. Au nom de Jésus, amen.",
        audioUrl:
          i % 4 === 0
            ? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3"
            : null,
        audioDurationSec: i % 4 === 0 ? 268 : null,
        status: "PUBLISHED",
        publishedAt: daysAgo(28 - i),
        createdAt: daysAgo(28 - i, 2),
      },
      select: { id: true },
    });
    friendPrayerIds.push(record.id);
  }

  // The test user favorites 11 of the friends' prayers.
  for (const [i, prayerId] of friendPrayerIds.slice(0, 11).entries()) {
    await prisma.prayerFavorite.create({
      data: { userId: listenerId, prayerId, createdAt: daysAgo(20 - i) },
    });
  }

  // 10 sermons by the test user + 2 by Aurora for catalog depth.
  const sermonSpecs = [
    {
      title: "Marcher par la foi et non par la vue",
      speaker: "Pasteur Emmanuel Kouassi",
      day: 34,
      status: "PUBLISHED",
    },
    {
      title: "La puissance de la persévérance",
      speaker: "Pasteur Emmanuel Kouassi",
      day: 28,
      status: "PUBLISHED",
    },
    {
      title: "Une maison bâtie sur le roc",
      speaker: "Pasteure Sarah Gbagbo",
      day: 24,
      status: "PUBLISHED",
    },
    {
      title: "Le sel de la terre, la lumière du monde",
      speaker: "Pasteur Emmanuel Kouassi",
      day: 20,
      status: "PUBLISHED",
    },
    {
      title: "Pardonner sept fois sept fois",
      speaker: "Pasteure Sarah Gbagbo",
      day: 16,
      status: "PUBLISHED",
    },
    {
      title: "L'espérance ne déçoit pas",
      speaker: "Pasteur Moïse Traoré",
      day: 12,
      status: "PUBLISHED",
    },
    {
      title: "Des talents multipliés",
      speaker: "Pasteur Moïse Traoré",
      day: 8,
      status: "PUBLISHED",
    },
    {
      title: "Veiller et prier",
      speaker: "Pasteure Sarah Gbagbo",
      day: 4,
      status: "PUBLISHED",
    },
    {
      title: "Série Pâques — épisode 1 (montage en cours)",
      speaker: "Pasteur Emmanuel Kouassi",
      day: 2,
      status: "DRAFT",
    },
    {
      title: "Enseignement des jeunes couples (interne)",
      speaker: "Pasteur Moïse Traoré",
      day: 1,
      status: "HIDDEN",
    },
  ] as const;
  for (const [i, sermon] of sermonSpecs.entries()) {
    await prisma.sermon.create({
      data: {
        authorId: listenerId,
        categoryId: category(i).id,
        title: sermon.title,
        description:
          "Enseignement enregistré lors de la célébration dominicale, durée d'écoute environ 35 minutes.",
        speakerName: sermon.speaker,
        audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 16) + 1}.mp3`,
        audioDurationSec: 1_900 + i * 120,
        imageUrl: null,
        status: sermon.status,
        publishedAt: daysAgo(sermon.day),
        createdAt: daysAgo(sermon.day, 4),
      },
    });
  }

  console.log("    prayer space: prayers, favorites, sermons");
}

/** Sheet-music generation jobs with results, progress and one failure. */
async function seedTooling(
  listenerId: string,
  songs: Array<{ id: string; title: string }>,
) {
  const completed = [
    {
      songIndex: 0,
      tempo: 96,
      signature: "4/4",
      notes: 412,
      measures: 64,
      confidence: 0.96,
      day: 21,
    },
    {
      songIndex: 1,
      tempo: 108,
      signature: "4/4",
      notes: 388,
      measures: 58,
      confidence: 0.94,
      day: 18,
    },
    {
      songIndex: 2,
      tempo: 72,
      signature: "3/4",
      notes: 264,
      measures: 48,
      confidence: 0.97,
      day: 16,
    },
    {
      songIndex: 3,
      tempo: 84,
      signature: "4/4",
      notes: 341,
      measures: 52,
      confidence: 0.92,
      day: 13,
    },
    {
      songIndex: 4,
      tempo: 120,
      signature: "4/4",
      notes: 476,
      measures: 68,
      confidence: 0.89,
      day: 11,
    },
    {
      songIndex: 5,
      tempo: 90,
      signature: "6/8",
      notes: 302,
      measures: 44,
      confidence: 0.95,
      day: 9,
    },
    {
      songIndex: 6,
      tempo: 100,
      signature: "4/4",
      notes: 419,
      measures: 60,
      confidence: 0.91,
      day: 6,
    },
    {
      songIndex: 7,
      tempo: 132,
      signature: "4/4",
      notes: 512,
      measures: 72,
      confidence: 0.88,
      day: 4,
    },
    {
      songIndex: 8,
      tempo: 76,
      signature: "3/4",
      notes: 287,
      measures: 50,
      confidence: 0.93,
      day: 2,
    },
    {
      songIndex: 9,
      tempo: 118,
      signature: "4/4",
      notes: 455,
      measures: 66,
      confidence: 0.9,
      day: 1,
    },
  ];
  const notesJson = (seed: number) =>
    Array.from({ length: 16 }, (_, i) => ({
      pitch: ["C", "D", "E", "F", "G", "A", "B"][(i + seed) % 7],
      octave: 4 + ((i + seed) % 2),
      startBeat: i * 2,
      durationBeats: 2,
      velocity: 0.6 + ((i * 7 + seed) % 4) / 10,
    }));

  for (const spec of completed) {
    const song = songs[spec.songIndex]!;
    const createdAt = daysAgo(spec.day, 6);
    await prisma.sheetMusicJob.create({
      data: {
        userId: listenerId,
        sourceSongId: song.id,
        sourceUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${spec.songIndex + 1}.mp3`,
        sourceName: song.title,
        status: "COMPLETED",
        progress: 100,
        createdAt,
        startedAt: new Date(createdAt.getTime() + 30_000),
        completedAt: new Date(createdAt.getTime() + 4 * 60_000),
        result: {
          create: {
            tempoBpm: spec.tempo,
            timeSignature: spec.signature,
            noteCount: spec.notes,
            measureCount: spec.measures,
            confidence: spec.confidence,
            engine: "phoenix-transcribe-v1",
            notes: notesJson(spec.songIndex),
            musicXml:
              `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><work><work-title>${song.title}</work-title></work>` +
              `<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>` +
              `<part id="P1"><measure number="1"><attributes><divisions>2</divisions><time><beats>${spec.signature.split("/")[0]}</beats><beat-type>${spec.signature.split("/")[1]}</beat-type></time></attributes></measure></part></score-partwise>`,
          },
        },
      },
    });
  }

  // In-flight job.
  const processingSong = songs[10]!;
  await prisma.sheetMusicJob.create({
    data: {
      userId: listenerId,
      sourceSongId: processingSong.id,
      sourceName: processingSong.title,
      status: "PROCESSING",
      progress: 65,
      createdAt: minutesAgo(8),
      startedAt: minutesAgo(7),
    },
  });

  // Failed job with a readable error.
  const failedSong = songs[11]!;
  await prisma.sheetMusicJob.create({
    data: {
      userId: listenerId,
      sourceSongId: failedSong.id,
      sourceName: failedSong.title,
      status: "FAILED",
      progress: 20,
      errorCode: "AUDIO_DECODE",
      errorMessage:
        "Impossible de décoder la piste : format audio non pris en charge.",
      createdAt: daysAgo(3, 6),
      startedAt: new Date(Date.now() - 3 * 86_400_000 - 6 * 3_600_000 + 20_000),
    },
  });

  console.log("    tools: sheet music jobs + results");
}

/** Advertiser profile, campaigns, creatives and tracked events. */
async function seedAdvertising(
  listenerId: string,
  friendIds: Record<string, string>,
) {
  const placements = await prisma.adPlacement.findMany();
  const placement = (i: number) => placements[i % placements.length]!;

  const advertiser = await prisma.advertiser.create({
    data: {
      userId: listenerId,
      name: "Nina Digital",
      businessName: "Nina Digital Sarl",
      contactEmail: "user@gmail.com",
      contactPhone: "+225 07 07 12 34 56",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const campaignSpecs = [
    {
      name: "Lancement boutique Nina — bannières",
      status: "ACTIVE",
      start: -12,
      end: 18,
      budget: 50_000,
      creatives: 2,
    },
    {
      name: "Promo audiobook — lecteur audio",
      status: "ACTIVE",
      start: -5,
      end: 25,
      budget: 30_000,
      creatives: 1,
    },
    {
      name: "Concert famille — pré-roll vidéo",
      status: "ACTIVE",
      start: -2,
      end: 28,
      budget: 80_000,
      creatives: 2,
    },
    {
      name: "Retargeting bibliothèque",
      status: "PAUSED",
      start: -20,
      end: 10,
      budget: 25_000,
      creatives: 1,
    },
    {
      name: "Soldes vinyles — boutique",
      status: "PAUSED",
      start: -30,
      end: 0,
      budget: 40_000,
      creatives: 2,
    },
    {
      name: "Nouveau clip — modération",
      status: "PENDING_REVIEW",
      start: 2,
      end: 30,
      budget: 35_000,
      creatives: 1,
    },
    {
      name: "Rentrée scolaire — modération",
      status: "PENDING_REVIEW",
      start: 5,
      end: 35,
      budget: 45_000,
      creatives: 1,
    },
    {
      name: "Abonnements page — validée",
      status: "APPROVED",
      start: 3,
      end: 33,
      budget: 20_000,
      creatives: 1,
    },
    {
      name: "Brouillon — festival kora",
      status: "DRAFT",
      start: 10,
      end: 40,
      budget: 60_000,
      creatives: 1,
    },
    {
      name: "Brouillon — goodies d'hiver",
      status: "DRAFT",
      start: 15,
      end: 45,
      budget: 15_000,
      creatives: 1,
    },
    {
      name: "Tournée 225 — terminée",
      status: "COMPLETED",
      start: -60,
      end: -20,
      budget: 90_000,
      creatives: 2,
    },
    {
      name: "Pub refusée — allégations santé",
      status: "REJECTED",
      start: -8,
      end: 22,
      budget: 22_000,
      creatives: 1,
      rejection: "Allégations de santé non autorisées dans le visuel.",
    },
  ] as const;

  const creativeSpecs = [
    {
      format: "IMAGE",
      headline: "Nouveau : la boutique Nina Digital",
      description: "Bijoux, vinyles et e-books livrés partout à Abidjan.",
      cta: "Découvrir",
      url: "https://phoenix.local/boutique/nina-digital",
    },
    {
      format: "IMAGE",
      headline: "-20% sur le vinyle Tidal Memory",
      description: "Offre limitée, pressage collector numéroté.",
      cta: "Profiter",
      url: "https://phoenix.local/boutique/vinyle-tidal",
    },
    {
      format: "VIDEO",
      headline: "Le roman audio Neon Tides est là",
      description: "8 chapitres lus par le groupe.",
      cta: "Écouter",
      url: "https://phoenix.local/audiobook/neon-tides",
    },
    {
      format: "VIDEO",
      headline: "Grand concert famille le 18 octobre",
      description: "Kora, zouglou et gospel sur une même scène.",
      cta: "Réserver",
      url: "https://phoenix.local/events/famille",
    },
    {
      format: "IMAGE",
      headline: "Retrouvez vos favoris hors-ligne",
      description: "Téléchargez et écoutez partout.",
      cta: "Voir",
      url: "https://phoenix.local/bibliotheque",
    },
    {
      format: "IMAGE",
      headline: "Nouveau clip — Fils du Fleuve",
      description: "Nadia Kora dévoile son clip tourné à Sikasso.",
      cta: "Regarder",
      url: "https://phoenix.local/videos/fils-du-fleuve",
    },
    {
      format: "IMAGE",
      headline: "Kits scolaires à prix fidélité",
      description: "Cahiers, cartables et fournitures livrés.",
      cta: "Commander",
      url: "https://phoenix.local/boutique/rentree",
    },
    {
      format: "VIDEO",
      headline: "Festival Kora d'Abidjan",
      description: "Trois jours de musique mandingue.",
      cta: "Billets",
      url: "https://phoenix.local/events/festival-kora",
    },
    {
      format: "IMAGE",
      headline: "Goodies d'hiver en approche",
      description: "Sweats chauds, bonnets et écharpes.",
      cta: "Aperçu",
      url: "https://phoenix.local/boutique/hiver",
    },
    {
      format: "IMAGE",
      headline: "Abonnez-vous à la page des artistes",
      description: "2500 FCFA/mois pour soutenir vos créateurs.",
      cta: "S'abonner",
      url: "https://phoenix.local/artistes",
    },
    {
      format: "VIDEO",
      headline: "La tournée 225 était inoubliable",
      description: "Revivez les temps forts en vidéo.",
      cta: "Revoir",
      url: "https://phoenix.local/videos/tournee-225",
    },
    {
      format: "IMAGE",
      headline: "Bottines scène — édition tournée",
      description: "Cuir grainé, série numérotée.",
      cta: "Voir",
      url: "https://phoenix.local/boutique/bottines",
    },
    {
      format: "IMAGE",
      headline: "Soldes vinyles — dernières pieces",
      description: "Jusqu'à -30% sur les pressages collector.",
      cta: "Voir",
      url: "https://phoenix.local/boutique/vinyles",
    },
    {
      format: "IMAGE",
      headline: "Concert famille : réservez votre place",
      description: "Tarif réduit pour les groupes.",
      cta: "Réserver",
      url: "https://phoenix.local/events/famille",
    },
    {
      format: "IMAGE",
      headline: "Clip nouveau — Oya Come Through",
      description: "Le nouveau titre de Mfoni en exclusivité.",
      cta: "Regarder",
      url: "https://phoenix.local/videos/oya",
    },
    {
      format: "IMAGE",
      headline: "Fournitures scolaires livrées",
      description: "Paiement mobile accepté.",
      cta: "Commander",
      url: "https://phoenix.local/boutique/rentree",
    },
  ];

  const activeCampaignIds: Array<{
    id: string;
    placementKey: string;
    creativeId: string;
  }> = [];
  const artworkPool = listThumbnailFiles();
  let creativeSeq = 0;
  for (const [i, spec] of campaignSpecs.entries()) {
    const placementRow = placement(i);
    const creativeImage = () =>
      artworkPool.length > 0
        ? `/thumbnails/${artworkPool[creativeSeq % artworkPool.length]}`
        : "https://picsum.photos/seed/phoenix-ad/640/360";
    const campaign = await prisma.adCampaign.create({
      data: {
        advertiserId: advertiser.id,
        placementId: placementRow.id,
        name: spec.name,
        startDate: daysAgo(-spec.start),
        endDate: daysAhead(spec.end),
        budget: spec.budget,
        currency: "XOF",
        status: spec.status,
        rejectionReason: "rejection" in spec ? spec.rejection : null,
        reviewedAt: spec.status === "REJECTED" ? daysAgo(7) : null,
        createdAt: daysAgo(Math.max(-spec.start + 3, 3)),
        creatives: {
          create: Array.from({ length: spec.creatives }, (_, k) => {
            const creative = creativeSpecs[creativeSeq % creativeSpecs.length]!;
            creativeSeq += 1;
            return {
              format: creative.format,
              mediaUrl:
                creative.format === "VIDEO"
                  ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
                  : creativeImage(),
              storageKey:
                creative.format === "VIDEO"
                  ? "seed/ad-creative.mp4"
                  : "seed/ad-creative.jpg",
              mimeType:
                creative.format === "VIDEO" ? "video/mp4" : "image/jpeg",
              fileSizeBytes: creative.format === "VIDEO" ? 4_200_000 : 320_000,
              durationSec: creative.format === "VIDEO" ? 15 : null,
              headline: creative.headline,
              description: creative.description,
              ctaLabel: creative.cta,
              actionUrl: creative.url,
            };
          }),
        },
      },
      include: {
        creatives: { select: { id: true } },
        placement: { select: { key: true } },
      },
    });
    if (spec.status === "ACTIVE" && campaign.creatives[0]) {
      activeCampaignIds.push({
        id: campaign.id,
        placementKey: campaign.placement.key,
        creativeId: campaign.creatives[0].id,
      });
    }
  }

  // Tracked events across the active campaigns (views from the test user).
  const eventPlan = [
    ...Array.from({ length: 24 }, (_, i) => ({
      type: "IMPRESSION",
      campaign: i % activeCampaignIds.length,
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      type: "VIEW",
      campaign: i % activeCampaignIds.length,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      type: "CLICK",
      campaign: (i + 1) % activeCampaignIds.length,
    })),
  ] as const;
  for (const [i, event] of eventPlan.entries()) {
    const target = activeCampaignIds[event.campaign]!;
    await prisma.adEvent.create({
      data: {
        campaignId: target.id,
        creativeId: target.creativeId,
        placementKey: target.placementKey,
        eventType: event.type,
        userId: listenerId,
        clientId: "seed-client-listener",
        clientEventId: `seed-ae-${String(i + 1).padStart(3, "0")}`,
        createdAt: daysAgo(10 - (i % 10), i % 5),
      },
    });
  }
  // A few events from the friends' devices for aggregate stats realism.
  let friendSeq = 0;
  for (const [key, friend] of Object.entries(friendIds)) {
    if (activeCampaignIds.length === 0) break;
    const target = activeCampaignIds[friendSeq % activeCampaignIds.length]!;
    friendSeq += 1;
    await prisma.adEvent.create({
      data: {
        campaignId: target.id,
        creativeId: target.creativeId,
        placementKey: target.placementKey,
        eventType: "IMPRESSION",
        userId: friend,
        clientId: `seed-client-${key}`,
        clientEventId: `seed-ae-friend-${key}`,
        createdAt: daysAgo(2, friendSeq),
      },
    });
  }

  console.log("    advertising: advertiser, campaigns, creatives, events");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// ---------------------------------------------------------------------------
// Wallet — balances, top-ups and transfers between the demo friends
// ---------------------------------------------------------------------------

function walletReference(n: number): string {
  return `PHX-WAL-SEED-${n.toString(36).toUpperCase()}`;
}

/** Tells the story of a small friend circle: top-ups then transfers. */
async function seedWalletWorld(
  listenerId: string,
  friendIds: Record<string, string>,
) {
  const people = [
    { key: "listener", id: listenerId },
    { key: "marie", id: friendIds["marie"]! },
    { key: "david", id: friendIds["david"]! },
    { key: "grace", id: friendIds["grace"]! },
    { key: "imran", id: friendIds["imran"]! },
  ] as const;

  const wallets = new Map<string, string>();
  for (const person of people) {
    const wallet = await prisma.wallet.create({
      data: { userId: person.id, balance: 0 },
    });
    wallets.set(person.key, wallet.id);
  }

  let refCounter = 0;
  const nextRef = () => walletReference((refCounter += 1));
  let minuteCounter = 60 * 24 * 21; // ledger starts ~3 weeks ago
  const at = () => new Date(Date.now() - minuteCounter-- * 60 * 1000);

  type Leg = {
    walletKey: (typeof people)[number]["key"];
    type: "TOPUP" | "TRANSFER_IN" | "TRANSFER_OUT";
    amount: number;
    counterpartyId: string | null;
    note: string | null;
    transferRef: string | null;
  };
  const balances = new Map<string, number>(people.map((p) => [p.key, 0]));
  const legs: Leg[] = [];

  const topup = (walletKey: Leg["walletKey"], amount: number, note: string) => {
    legs.push({
      walletKey,
      type: "TOPUP",
      amount,
      counterpartyId: null,
      note,
      transferRef: null,
    });
  };
  const transfer = (
    fromKey: Leg["walletKey"],
    toKey: Leg["walletKey"],
    amount: number,
    note: string,
  ) => {
    const transferRef = nextRef();
    const fromId = people.find((p) => p.key === fromKey)!.id;
    const toId = people.find((p) => p.key === toKey)!.id;
    legs.push({
      walletKey: fromKey,
      type: "TRANSFER_OUT",
      amount,
      counterpartyId: toId,
      note,
      transferRef,
    });
    legs.push({
      walletKey: toKey,
      type: "TRANSFER_IN",
      amount,
      counterpartyId: fromId,
      note,
      transferRef,
    });
  };

  topup("listener", 50_000, "Rechargement Orange Money");
  topup("marie", 30_000, "Rechargement Wave");
  topup("david", 20_000, "Rechargement Orange Money");
  topup("grace", 25_000, "Rechargement Moov");
  topup("imran", 15_000, "Rechargement Wave");
  transfer("listener", "marie", 5_000, "Merci pour le attiéké 🍲");
  transfer("listener", "david", 2_500, "Part du taxi");
  transfer("grace", "listener", 10_000, "Remboursement concert");
  transfer("marie", "david", 2_000, "Photo cadre déco");
  transfer("imran", "listener", 1_500, "Devoir prêté");

  for (const leg of legs) {
    const balance = balances.get(leg.walletKey)! + leg.amount;
    balances.set(leg.walletKey, balance);
    await prisma.walletTransaction.create({
      data: {
        walletId: wallets.get(leg.walletKey)!,
        type: leg.type,
        status: "SUCCESS",
        amount: leg.amount,
        balanceAfter: balance,
        reference: nextRef(),
        transferRef: leg.transferRef,
        note: leg.note,
        counterpartyId: leg.counterpartyId,
        createdAt: at(),
      },
    });
  }

  for (const person of people) {
    await prisma.wallet.update({
      where: { id: wallets.get(person.key)! },
      data: { balance: balances.get(person.key)! },
    });
  }
  console.log(`  wallets: ${people.length} funded for the demo friend circle`);
}
