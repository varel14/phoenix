/** API resource shapes returned by the Phoenix API. */

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
}

export type MediaType = "SONG" | "VIDEO";
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ARTIST";
  image: string | null;
};
