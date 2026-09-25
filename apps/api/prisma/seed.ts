import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { auth } from "../src/lib/auth.js";
import { listThumbnailFiles } from "../src/lib/thumbnails.js";

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
      { title: "Neon Tides", album: "Tidal Memory", genre: "Electronic", url: SOUNDHELIX(1), duration: 372 },
      { title: "Midnight Drive", album: "Tidal Memory", genre: "Electronic", url: SOUNDHELIX(2), duration: 425 },
      { title: "Reflections", album: "Polar", genre: "Ambient", url: SOUNDHELIX(3), duration: 309 },
      { title: "Aurora Borealis", album: "Polar", genre: "Ambient", url: SOUNDHELIX(4), duration: 296 },
    ],
  },
  {
    key: "solaris",
    name: "The Solaris Band",
    bio: "Indie rock quartet from the coast. Loud guitars, bigger choruses.",
    songs: [
      { title: "Golden Hour", album: "Golden Hour", genre: "Indie Rock", url: SOUNDHELIX(5), duration: 348 },
      { title: "Static Love", album: "Golden Hour", genre: "Indie Rock", url: SOUNDHELIX(6), duration: 383 },
      { title: "Runaway Hearts", album: "Golden Hour", genre: "Rock", url: SOUNDHELIX(7), duration: 331 },
    ],
  },
  {
    key: "celeste",
    name: "Celeste Moreau",
    bio: "Franco-Belgian pianist and composer. Minimal, intimate, timeless.",
    songs: [
      { title: "Lettre à Paris", album: "Lettres Vol. 1", genre: "Classical", url: SOUNDHELIX(8), duration: 356 },
      { title: "Nocturne No. 3", album: "Lettres Vol. 1", genre: "Classical", url: SOUNDHELIX(9), duration: 284 },
      { title: "Petite Valse", album: "Lettres Vol. 1", genre: "Classical", url: SOUNDHELIX(10), duration: 244 },
    ],
  },
  {
    key: "kaya",
    name: "Kaya Sound System",
    bio: "Roots reggae collective spreading good vibrations since 2015.",
    songs: [
      { title: "Riddim Rider", album: "Sound System Sessions", genre: "Reggae", url: SOUNDHELIX(11), duration: 395 },
      { title: "Sunset Skank", album: "Sound System Sessions", genre: "Reggae", url: SOUNDHELIX(12), duration: 367 },
      { title: "Dub Voyage", album: "Sound System Sessions", genre: "Dub", url: SOUNDHELIX(13), duration: 412 },
      { title: "Freedom Chant", album: "Sound System Sessions", genre: "Reggae", url: SOUNDHELIX(14), duration: 353 },
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
 * Balanced-random artwork dealer: shuffle the apps/thumbnails image pool
 * once, then deal it round-robin across every album and video so all images
 * are used (nearly) the same number of times. Returns null when the folder
 * is missing/empty (callers fall back to remote posters).
 */
function createArtworkDealer() {
  const files = listThumbnailFiles();
  if (files.length === 0) {
    console.warn("  no images found in apps/thumbnails — falling back to remote posters");
    return () => null;
  }
  for (let i = files.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [files[i], files[j]] = [files[j]!, files[i]!];
  }
  let cursor = 0;
  console.log(`  artwork pool: ${files.length} images from apps/thumbnails`);
  return () => `/thumbnails/${files[cursor++ % files.length]}`;
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
  const nextArtwork = createArtworkDealer();
  // All songs of an album share its cover; albums and videos draw from the
  // same balanced rotation (13 units over 12 images ≈ perfectly balanced).
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
      thumbnailUrl: nextArtwork() ?? GTV_POSTER(video.url.split("/").pop()!.replace(".mp4", "")),
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

  console.log(`  demo accounts: password "${DEMO_PASSWORD}" for listener@phoenix.local + creators`);
  console.log("Seed complete.");
}

// ---------------------------------------------------------------------------
// Chuyassi Emmanuel Pay / Exchange catalog
// ---------------------------------------------------------------------------

async function seedPaymentCatalog() {
  const categories = [
    { name: "Frais scolaires", slug: "frais-scolaires", icon: "school", sortOrder: 1 },
    { name: "Factures", slug: "factures", icon: "flash", sortOrder: 2 },
    { name: "Services administratifs", slug: "services-administratifs", icon: "document", sortOrder: 3 },
    { name: "Services partenaires", slug: "services-partenaires", icon: "business", sortOrder: 4 },
    { name: "Autres services", slug: "autres-services", icon: "more", sortOrder: 5 },
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
      description: "Réglez les frais de scolarité d'un élève dans un établissement partenaire.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 5000,
      fields: [
        { key: "studentName", label: "Nom de l'élève", type: "TEXT" as const, options: null as string[] | null, sortOrder: 0 },
        { key: "school", label: "Établissement", type: "TEXT" as const, options: null as string[] | null, sortOrder: 1 },
        { key: "matricule", label: "Matricule", type: "TEXT" as const, options: null as string[] | null, sortOrder: 2 },
        { key: "class", label: "Classe", type: "TEXT" as const, options: null as string[] | null, sortOrder: 3 },
        { key: "phone", label: "Téléphone", type: "PHONE" as const, options: null as string[] | null, sortOrder: 4 },
      ],
    },
    {
      category: "frais-scolaires",
      name: "Frais universitaires",
      description: "Inscriptions, réinscriptions et frais académiques universitaires.",
      pricingMode: "FREE" as const,
      fixedPrice: null as number | null,
      minPrice: 10000,
      fields: [
        { key: "studentName", label: "Nom de l'étudiant", type: "TEXT" as const, options: null as string[] | null, sortOrder: 0 },
        { key: "university", label: "Université", type: "TEXT" as const, options: null as string[] | null, sortOrder: 1 },
        { key: "matricule", label: "Matricule", type: "TEXT" as const, options: null as string[] | null, sortOrder: 2 },
        { key: "phone", label: "Téléphone", type: "PHONE" as const, options: null as string[] | null, sortOrder: 3 },
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
        { key: "customerNumber", label: "Numéro client", type: "TEXT" as const, options: null as string[] | null, sortOrder: 0 },
        { key: "invoiceRef", label: "Référence facture", type: "TEXT" as const, options: null as string[] | null, sortOrder: 1 },
        { key: "phone", label: "Téléphone", type: "PHONE" as const, options: null as string[] | null, sortOrder: 2 },
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
        { key: "customerNumber", label: "Numéro client", type: "TEXT" as const, options: null as string[] | null, sortOrder: 0 },
        { key: "invoiceRef", label: "Référence facture", type: "TEXT" as const, options: null as string[] | null, sortOrder: 1 },
        { key: "phone", label: "Téléphone", type: "PHONE" as const, options: null as string[] | null, sortOrder: 2 },
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
        { key: "fullName", label: "Nom complet", type: "TEXT" as const, options: null as string[] | null, sortOrder: 0 },
        { key: "birthDate", label: "Date de naissance", type: "TEXT" as const, options: null as string[] | null, sortOrder: 1 },
        { key: "birthPlace", label: "Lieu de naissance", type: "TEXT" as const, options: null as string[] | null, sortOrder: 2 },
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
        { key: "fullName", label: "Nom complet", type: "TEXT" as const, options: null as string[] | null, sortOrder: 0 },
        { key: "quarter", label: "Quartier de résidence", type: "TEXT" as const, options: null as string[] | null, sortOrder: 1 },
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
        { key: "accountNumber", label: "Numéro de compte", type: "TEXT" as const, options: null as string[] | null, sortOrder: 0 },
        { key: "plan", label: "Formule", type: "SELECT" as const, options: ["Jour", "Semaine", "Mois"], sortOrder: 1 },
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
      await prisma.paymentService.update({ where: { id: existing.id }, data: base });
      await prisma.paymentServiceField.deleteMany({ where: { serviceId: existing.id } });
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

const THUMB = (file: string) => `/thumbnails/${file}`;

async function seedMarketplace(createdArtists: Map<string, string>) {
  const sellerId = createdArtists.get("aurora")!;

  const categories = [
    { name: "Livres & E-books", slug: "livres", imageUrl: THUMB("istockphoto-1031437062-612x612.jpg"), sortOrder: 1 },
    { name: "Audiobooks", slug: "audiobooks", imageUrl: THUMB("pexels-yankrukov-9005465.jpg"), sortOrder: 2 },
    { name: "Vêtements", slug: "vetements", imageUrl: THUMB("pexels-yasinaydin-14984551.jpg"), sortOrder: 3 },
    { name: "Bijoux", slug: "bijoux", imageUrl: THUMB("pexels-tolgaaslanturk-10781266.jpg"), sortOrder: 4 },
    { name: "Chaussures", slug: "chaussures", imageUrl: THUMB("istockphoto-486420378-612x612.jpg"), sortOrder: 5 },
    { name: "Merch artiste", slug: "merch", imageUrl: THUMB("pexels-mart-production-7271800.jpg"), sortOrder: 6 },
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

  const products = [
    {
      name: "Livre numérique — Mémoires d'Aurora (PDF)",
      category: "livres",
      type: "DIGITAL" as const,
      price: 3500,
      description:
        "Le premier livre numérique d'Aurora Waves : coulisses de création, partitions commentées et photos inédites. Téléchargement PDF après paiement.",
      digitalStorageKey: "demo-ebook-memoires.pdf",
      downloadLimit: 5,
      images: [THUMB("istockphoto-1031437062-612x612.jpg")],
      variants: [] as Array<{ name: string; sku: string; stock: number }>,
    },
    {
      name: "Audiobook — Neon Tides, le roman audio",
      category: "audiobooks",
      type: "DIGITAL" as const,
      price: 5000,
      description: "L'histoire de l'album Neon Tides racontée par le groupe, en 8 chapitres audio.",
      digitalStorageKey: "demo-audiobook-neon-tides.mp3",
      images: [THUMB("pexels-yankrukov-9005465.jpg")],
      variants: [] as Array<{ name: string; sku: string; stock: number }>,
    },
    {
      name: "T-shirt Aurora Waves",
      category: "vetements",
      type: "PHYSICAL" as const,
      price: 7500,
      stock: 40,
      description: "Le t-shirt officiel de la tournée — coton bio, sérigraphie premium. Coupe unisexe.",
      images: [THUMB("pexels-yasinaydin-14984551.jpg"), THUMB("pexels-mart-production-7271800.jpg")],
      variants: [
        { name: "S", sku: "TSH-AUR-S", stock: 10 },
        { name: "M", sku: "TSH-AUR-M", stock: 15 },
        { name: "L", sku: "TSH-AUR-L", stock: 10 },
        { name: "XL", sku: "TSH-AUR-XL", stock: 5 },
      ],
    },
    {
      name: "Bracelet Brut — édition limitée",
      category: "bijoux",
      type: "PHYSICAL" as const,
      price: 12000,
      stock: 12,
      description: "Bracelet homme en acier brossé, gravé du phénix Phoenix. Édition limitée à 50 exemplaires.",
      images: [THUMB("pexels-tolgaaslanturk-10781266.jpg")],
      variants: [
        { name: "19 cm", sku: "BRC-19", stock: 6 },
        { name: "21 cm", sku: "BRC-21", stock: 6 },
      ],
    },
    {
      name: "Sneakers Phoenix Rise",
      category: "chaussures",
      type: "PHYSICAL" as const,
      price: 28000,
      stock: 20,
      description: "La sneaker collab du label : mesh respirant, semelle amortissante, dégradé violet-rose.",
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
      category: "merch",
      type: "PHYSICAL" as const,
      price: 9000,
      stock: 25,
      description: "Affiche A3 du concert live, signée à la main par les membres du groupe.",
      images: [THUMB("istockphoto-1324561072-612x612.jpg")],
      variants: [] as Array<{ name: string; sku: string; stock: number }>,
    },
  ];

  let created = 0;
  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name, sellerId },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.product.create({
      data: {
        sellerId,
        categoryId: categoryIds.get(product.category)!,
        name: product.name,
        description: product.description,
        type: product.type,
        price: product.price,
        stock: product.type === "PHYSICAL" ? product.stock : null,
        digitalStorageKey: product.type === "DIGITAL" ? product.digitalStorageKey : null,
        downloadLimit: product.type === "DIGITAL" ? product.downloadLimit : null,
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
  console.log(`  boutique products: ${created} created (${products.length} total)`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
