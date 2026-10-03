import { useDownloadsStore, selectDownloadState } from "@/services/downloads/download-manager";
import { useToggleFavorite } from "@/hooks/use-catalog";
import { MediaRow } from "./media-row";
import { ProgressBar } from "@/components/ui";
import { AppText } from "@/components/ui/primitives";
import { useTheme } from "@/theme/theme-provider";
import { formatFileSize } from "@/utils/format";
import { View } from "react-native";
import type { MenuAction } from "@/components/ui";
import type { Song, Video } from "@/types/api";

interface InteractiveRowProps {
  media: Song | Video;
  mediaType: "SONG" | "VIDEO";
  isFavorite: boolean;
  onPlay: () => void;
  onAddToPlaylist?: (song: Song) => void;
  /** Extra actions surfaced in the ⋮ menu (after favorite, before "View artist"). */
  menuActions?: MenuAction[];
  /** Replaces the default "artist · duration · plays" subtitle (e.g. studio analytics). */
  subtitleOverride?: string;
}

/**
 * MediaRow wired with favorite toggle, download action and progress.
 * Every list screen uses this so behavior is consistent app-wide.
 */
export function InteractiveRow({ media, mediaType, isFavorite, onPlay, onAddToPlaylist, menuActions, subtitleOverride }: InteractiveRowProps) {
  const toggleFavorite = useToggleFavorite();
  const downloadState = useDownloadsStore((state) => selectDownloadState(state, mediaType, media.id));
  const isDownloaded = useDownloadsStore((state) =>
    state.library.some((entry) => entry.mediaType === mediaType && entry.mediaId === media.id),
  );
  const startDownload = useDownloadsStore((state) => state.start);
  const removeDownload = useDownloadsStore((state) => state.remove);

  const downloading = downloadState?.state === "downloading" || downloadState?.state === "paused";
  const downloadable = media.isDownloadable;

  return (
    <View>
      <MediaRow
        media={media}
        mediaType={mediaType}
        isFavorite={isFavorite}
        onPlay={onPlay}
        onToggleFavorite={() => toggleFavorite.mutate({ mediaType, mediaId: media.id, favorite: !isFavorite })}
        subtitleOverride={
          subtitleOverride ??
          (mediaType === "SONG" && isDownloaded ? `${media.artist.name} · available offline` : undefined)
        }
        menuActions={
          downloadable
            ? [
                isDownloaded
                  ? {
                      label: "Delete download",
                      icon: "trash-outline" as const,
                      onPress: () => void removeDownload(mediaType, media.id),
                    }
                  : {
                      label: downloading ? "Downloading…" : "Download",
                      icon: "download-outline" as const,
                      onPress: () => {
                        if (!downloading) void startDownload(media);
                      },
                    },
                ...(onAddToPlaylist && mediaType === "SONG"
                  ? [
                      {
                        label: "Add to playlist",
                        icon: "add-circle-outline" as const,
                        onPress: () => onAddToPlaylist(media as Song),
                      },
                    ]
                  : []),
                ...(menuActions ?? []),
              ]
            : (menuActions ?? [])
        }
        right={
          downloading ? (
            <View style={{ width: 44, paddingHorizontal: 4, gap: 2 }}>
              <ProgressBar progress={downloadState?.progress ?? 0} />
              <DownloadSize media={media} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

function DownloadSize({ media }: { media: Song | Video }) {
  const { colors } = useTheme();
  const size = "fileSizeBytes" in media ? media.fileSizeBytes : null;
  if (!size) return null;
  return <AppText style={{ fontSize: 9, color: colors.textMuted }}>{formatFileSize(size)}</AppText>;
}
