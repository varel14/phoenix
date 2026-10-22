/** API resource shapes returned by the Chuyassi Emmanuel CE API. */

export interface ArtistSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

export interface Song {
  id: string;
  artistId: string;
  title: string;
  genre: string | null;
  albumName: string | null;
  audioUrl: string;
  thumbnailUrl: string | null;
  mimeType: string | null;
  durationSec: number | null;
  fileSizeBytes: number | null;
  isDownloadable: boolean;
  playCount: number;
  downloadCount: number;
  publishedAt: string;
  artist: ArtistSummary;
}

export interface Video {
  id: string;
  artistId: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  mimeType: string | null;
  durationSec: number | null;
  fileSizeBytes: number | null;
  isDownloadable: boolean;
  viewCount: number;
  downloadCount: number;
  publishedAt: string;
  artist: ArtistSummary;
}

export interface ArtistWithCounts {
  id: string;
  userId: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isVerified: boolean;
  createdAt: string;
  _count: { songs: number; videos: number; followers: number };
}

export interface ArtistDetail extends ArtistWithCounts {
  songs: Song[];
  videos: Video[];
  isFollowing?: boolean;
}

export interface FavoriteRecord {
  id: string;
  userId: string;
  songId: string | null;
  videoId: string | null;
  createdAt: string;
  song?: Song | null;
  video?: Video | null;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { items: number };
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  songId: string;
  position: number;
  addedAt: string;
  song: Song;
}

export interface DownloadRecord {
  id: string;
  userId: string;
  songId: string | null;
  videoId: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  createdAt: string;
  completedAt: string | null;
  song?: Song | null;
  video?: Video | null;
}

export interface ArtistStats {
  plays: number;
  views: number;
  downloads: number;
  subscribers: number;
  favorites: number;
  songs: number;
  videos: number;
  /** Distinct listeners across all songs (lifetime). */
  uniqueListeners: number;
  /** Money earned from paid song downloads (1 FCFA each), in XOF. */
  downloadRevenue: number;
  topSongs: Array<{
    id: string;
    title: string;
    playCount: number;
    downloadCount: number;
    favorites: number;
  }>;
  topVideos: Array<{
    id: string;
    title: string;
    viewCount: number;
    downloadCount: number;
  }>;
  daily: Array<{ date: string; plays: number; views: number }>;
  /** Every published song with its activity/popularity breakdown. */
  songStats: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    durationSec: number | null;
    publishedAt: string;
    playCount: number;
    downloadCount: number;
    favorites: number;
    uniqueListeners: number;
    plays30d: number;
  }>;
}

export type MediaType = "SONG" | "VIDEO";
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ARTIST";
  image: string | null;
  /** Present in better-auth sessions — powers "Membre depuis" on the profile. */
  createdAt?: string;
};

// -- Page subscription (2 500 FCFA/mois) & download royalties (1 FCFA/mois) ---

export type PageSubscriptionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED";

export interface PageSubscription {
  id: string;
  userId: string;
  artistId: string;
  monthlyAmount: number;
  currency: string;
  status: PageSubscriptionStatus;
  autoRenew: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  artist?: { id: string; name: string; avatarUrl: string | null };
}

export interface SubscriptionPricing {
  monthlyPrice: number;
  downloadRoyalty: number;
  currency: string;
}

export interface SubscriptionStatus {
  subscription: PageSubscription | null;
  pricing: SubscriptionPricing;
  usage: {
    downloadedTracks: number;
    royaltyDueThisMonth: number;
    royaltyTotal: number;
  };
  history: Array<{ periodStart: string; downloads: number; amount: number }>;
}

export interface RoyaltyMonth {
  periodStart: string;
  downloads: number;
  amount: number;
}

export interface ArtistRoyaltyEarnings {
  artist: { id: string; name: string };
  months: RoyaltyMonth[];
  total: number;
  subscribers: number;
  pricing: SubscriptionPricing;
}
