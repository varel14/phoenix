import { prisma } from "../config/prisma.js";
import {
  DOWNLOAD_ROYALTY_MONTHLY_PRICE,
  PAGE_SUBSCRIPTION_MONTHLY_PRICE,
  PRICING_CURRENCY,
  addMonths,
  monthPeriodStart,
} from "../config/pricing.js";
import { AppError } from "../lib/errors.js";
import { generateReference, SUBSCRIPTION_REFERENCE_PREFIX } from "../lib/refs.js";
import {
  subscriptionRepository,
  type PageSubscriptionWithArtist,
} from "../repositories/subscription.repository.js";
import type { SubscribeBody } from "../validators/subscription.schema.js";

export const SUBSCRIPTION_REQUIRED_CODE = "SUBSCRIPTION_REQUIRED";

type RoyaltyRow = {
  downloadId: string;
  artistId: string;
  userId: string;
  periodStart: Date;
  amount: number;
  currency: string;
};

type RoyaltyBearingDownload = {
  id: string;
  createdAt: Date;
  song: { artistId: string } | null;
  video: { artistId: string } | null;
};

/** One royalty row per kept download per elapsed month, capped at the current month. */
function buildRoyaltyRows(
  downloads: RoyaltyBearingDownload[],
  userId: string,
  artistFilter?: string | undefined,
): RoyaltyRow[] {
  const lastPeriod = monthPeriodStart();
  const rows: RoyaltyRow[] = [];
  for (const download of downloads) {
    const artistId = download.song?.artistId ?? download.video?.artistId;
    if (!artistId) continue;
    if (artistFilter && artistId !== artistFilter) continue;
    let period = monthPeriodStart(download.createdAt);
    while (period <= lastPeriod) {
      rows.push({
        downloadId: download.id,
        artistId,
        userId,
        periodStart: period,
        amount: DOWNLOAD_ROYALTY_MONTHLY_PRICE,
        currency: PRICING_CURRENCY,
      });
      period = addMonths(period, 1);
    }
  }
  return rows;
}

export type SubscriptionStatus = {
  subscription: PageSubscriptionWithArtist | null;
  pricing: { monthlyPrice: number; downloadRoyalty: number; currency: string };
  usage: { downloadedTracks: number; royaltyDueThisMonth: number; royaltyTotal: number };
  history: Array<{ periodStart: Date; downloads: number; amount: number }>;
};

function assertActive(subscription: { status: string; currentPeriodEnd: Date } | null): boolean {
  return !!subscription && subscription.status === "ACTIVE" && subscription.currentPeriodEnd > new Date();
}

export const subscriptionService = {
  /** Resolves the page to subscribe to; defaults to the app's main artist. */
  async resolveArtistId(artistId?: string | undefined): Promise<string> {
    if (artistId) {
      const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true } });
      if (!artist) throw AppError.notFound("Artist");
      return artist.id;
    }
    const fallback = await subscriptionRepository.findDefaultArtist();
    if (!fallback) throw AppError.notFound("Artist");
    return fallback.id;
  },

  /**
   * Subscribes (or renews) the user to an artist page for
   * PAGE_SUBSCRIPTION_MONTHLY_PRICE. The payment is recorded as a settled
   * transaction + receipt; the period is extended by one month.
   */
  async subscribe(userId: string, body: SubscribeBody) {
    const artistId = await this.resolveArtistId(body.artistId);
    const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, name: true } });
    if (!artist) throw AppError.notFound("Artist");

    const now = new Date();
    const existing = await subscriptionRepository.findAnyByUserAndArtist(userId, artistId);

    let subscription;
    if (existing && assertActive(existing)) {
      // Early renewal: stack the new period after the current one.
      const start = existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
      subscription = await subscriptionRepository.upsertActive(existing, {
        start,
        end: addMonths(start, 1),
      });
    } else if (existing) {
      subscription = await subscriptionRepository.upsertActive(existing, {
        start: now,
        end: addMonths(now, 1),
      });
    } else {
      subscription = await subscriptionRepository.create(
        userId,
        artistId,
        PAGE_SUBSCRIPTION_MONTHLY_PRICE,
        PRICING_CURRENCY,
        addMonths(now, 1),
      );
    }

    const reference = generateReference(SUBSCRIPTION_REFERENCE_PREFIX);
    const transaction = await prisma.paymentTransaction.create({
      data: {
        userId,
        reference,
        provider: "simulated",
        amount: PAGE_SUBSCRIPTION_MONTHLY_PRICE,
        currency: PRICING_CURRENCY,
        status: "SUCCESS",
        paidAt: now,
        metadata: {
          kind: "page_subscription",
          artistId,
          artistName: artist.name,
          periodStart: subscription.currentPeriodStart.toISOString(),
          periodEnd: subscription.currentPeriodEnd.toISOString(),
        },
      },
    });
    await prisma.paymentReceipt.upsert({
      where: { transactionId: transaction.id },
      create: {
        transactionId: transaction.id,
        reference,
        amount: transaction.amount,
        currency: transaction.currency,
        method: transaction.provider,
      },
      update: {},
    });

    return { subscription, transaction, artist };
  },

  /** Throws 403 SUBSCRIPTION_REQUIRED when the user has no live page subscription. */
  async requireActive(userId: string, artistId: string): Promise<void> {
    const subscription = await subscriptionRepository.findActiveByUserAndArtist(userId, artistId);
    if (!assertActive(subscription)) {
      throw new AppError(
        403,
        SUBSCRIPTION_REQUIRED_CODE,
        "An active subscription to the artist's page is required to download tracks",
      );
    }
  },

  /** Accrues the 1 FCFA/month royalty for every kept download, idempotently. */
  async accrueRoyaltiesForUser(userId: string): Promise<number> {
    const subscription = await subscriptionRepository.findActiveByUser(userId);
    if (!subscription) return 0;

    const downloads = await subscriptionRepository.findRoyaltyBearingDownloads(userId);
    return subscriptionRepository.createManyRoyalties(buildRoyaltyRows(downloads, userId));
  },

  /** Subscription status + royalty usage for the subscriber app. */
  async getMyStatus(userId: string): Promise<SubscriptionStatus> {
    await this.accrueRoyaltiesForUser(userId);
    const [subscription, downloadedTracks, royaltyTotal, history] = await Promise.all([
      subscriptionRepository.findActiveByUser(userId),
      subscriptionRepository.countCompletedDownloads(userId),
      subscriptionRepository.sumRoyaltiesByUser(userId),
      subscriptionRepository.listRoyaltyMonthsByUser(userId),
    ]);
    return {
      subscription,
      pricing: {
        monthlyPrice: PAGE_SUBSCRIPTION_MONTHLY_PRICE,
        downloadRoyalty: DOWNLOAD_ROYALTY_MONTHLY_PRICE,
        currency: PRICING_CURRENCY,
      },
      usage: {
        downloadedTracks,
        royaltyDueThisMonth: downloadedTracks * DOWNLOAD_ROYALTY_MONTHLY_PRICE,
        royaltyTotal,
      },
      history,
    };
  },

  async cancel(userId: string, artistId?: string | undefined): Promise<{ cancelled: number }> {
    if (artistId) {
      const existing = await subscriptionRepository.findAnyByUserAndArtist(userId, artistId);
      if (!existing) throw AppError.notFound("Subscription");
      await subscriptionRepository.cancel(existing.id);
      return { cancelled: 1 };
    }
    const cancelled = await subscriptionRepository.cancelAllByUser(userId);
    return { cancelled };
  },

  /** The user's payable royalty history (what their downloads cost per month). */
  async listMyRoyalties(userId: string) {
    await this.accrueRoyaltiesForUser(userId);
    const [history, total] = await Promise.all([
      subscriptionRepository.listRoyaltyMonthsByUser(userId),
      subscriptionRepository.sumRoyaltiesByUser(userId),
    ]);
    return {
      months: history,
      total,
      pricing: { downloadRoyalty: DOWNLOAD_ROYALTY_MONTHLY_PRICE, currency: PRICING_CURRENCY },
    };
  },

  /** Artist-facing earnings: 1 FCFA/month per kept download, per subscriber. */
  async getArtistEarnings(userId: string) {
    const artist = await subscriptionRepository.findArtistByUserId(userId);
    if (!artist) throw AppError.notFound("Artist");
    // Accrue for every subscriber of this artist before reading totals.
    const subs = await prisma.pageSubscription.findMany({
      where: { artistId: artist.id, status: "ACTIVE" },
      select: { userId: true },
    });
    for (const sub of subs) {
      const downloads = await prisma.download.findMany({
        where: { userId: sub.userId, status: "COMPLETED" },
        select: { id: true, createdAt: true, song: { select: { artistId: true } }, video: { select: { artistId: true } } },
      });
      await subscriptionRepository.createManyRoyalties(buildRoyaltyRows(downloads, sub.userId, artist.id));
    }
    const [history, total, subscribers] = await Promise.all([
      subscriptionRepository.listRoyaltyMonthsByArtist(artist.id),
      subscriptionRepository.sumRoyaltiesByArtist(artist.id),
      subscriptionRepository.countActiveSubscribers(artist.id),
    ]);
    return {
      artist,
      months: history,
      total,
      subscribers,
      pricing: { downloadRoyalty: DOWNLOAD_ROYALTY_MONTHLY_PRICE, currency: PRICING_CURRENCY },
    };
  },

  /** Royalty row for a freshly registered download (current month). */
  async accrueForNewDownload(input: {
    downloadId: string;
    artistId: string;
    userId: string;
  }): Promise<void> {
    await subscriptionRepository.createRoyalty({
      downloadId: input.downloadId,
      artistId: input.artistId,
      userId: input.userId,
      periodStart: monthPeriodStart(),
      amount: DOWNLOAD_ROYALTY_MONTHLY_PRICE,
      currency: PRICING_CURRENCY,
    });
  },
};
