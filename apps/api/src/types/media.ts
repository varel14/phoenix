/** Shared select shapes reused across repositories/services. */
export const artistSummarySelect = {
  id: true,
  name: true,
  avatarUrl: true,
  isVerified: true,
} as const;

export const songInclude = {
  artist: { select: artistSummarySelect },
} as const;

export const videoInclude = {
  artist: { select: artistSummarySelect },
} as const;

export type SongWithArtist = {
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
  publishedAt: Date;
  artist: { id: string; name: string; avatarUrl: string | null; isVerified: boolean };
};

export type VideoWithArtist = {
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
  publishedAt: Date;
  artist: { id: string; name: string; avatarUrl: string | null; isVerified: boolean };
};
