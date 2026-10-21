import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { AppText, PressableScale } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import { API_URL } from "@/services/api/api-client";
import { resolveVoiceNote } from "@/services/media/voice-cache";
import type { MessageAttachment } from "@/types/chat";

interface VoicePlayerProps {
  attachment: MessageAttachment;
  incoming: boolean;
}

const BAR_COUNT = 24;

/** Deterministic bar heights so a given voice note always draws the same waveform. */
function waveformHeights(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const peak = ((hash >>> 16) % 1000) / 1000;
    // Ease toward the middle so the shape reads like a real waveform envelope.
    const envelope =
      0.55 + 0.45 * Math.sin((index / (BAR_COUNT - 1)) * Math.PI);
    return Math.round(5 + peak * 15 * envelope);
  });
}

/**
 * Play/pause control + waveform progress for a voice message bubble.
 * Voice notes are fully downloaded before playback starts (no partial
 * streaming): the first tap fetches the whole file with progress drawn over
 * the waveform, and the local copy serves every later listen instantly.
 */
export function VoicePlayer({ attachment, incoming }: VoicePlayerProps) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [trackDuration, setTrackDuration] = useState(0);
  const declaredDuration = attachment.durationSec ?? 0;
  const bars = useMemo(
    () => waveformHeights(attachment.id + attachment.storageKey),
    [attachment.id, attachment.storageKey],
  );

  const sourceUri = attachment.url.startsWith("http")
    ? attachment.url
    : `${API_URL}${attachment.url}`;
  const player = useAudioPlayer(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      setPosition(status.currentTime);
      if (status.duration > 0) setTrackDuration(status.duration);
      if (status.playing !== playing) setPlaying(status.playing);
      if (status.didJustFinish && !finishedRef.current) {
        finishedRef.current = true;
        setPlaying(false);
        setPosition(0);
      }
      if (!status.didJustFinish) finishedRef.current = false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  async function startPlayback() {
    if (loaded) {
      player.play();
      setPlaying(true);
      return;
    }
    setFailed(false);
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const localUri = await resolveVoiceNote(
        sourceUri,
        attachment.storageKey,
        setDownloadProgress,
      );
      player.replace({ uri: localUri });
      setLoaded(true);
      setDownloading(false);
      player.play();
      setPlaying(true);
    } catch {
      setDownloading(false);
      setFailed(true);
    }
  }

  function toggle() {
    if (downloading) return;
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      void startPlayback();
    }
  }

  const accent = incoming ? colors.primary : colors.onPrimary;
  const idleColor = incoming
    ? colors.surfaceHighlight
    : "rgba(255,255,255,0.35)";
  const duration = trackDuration || declaredDuration;
  const progress = downloading
    ? downloadProgress
    : duration > 0
      ? Math.min(1, position / duration)
      : 0;
  const filledBars = Math.round(progress * BAR_COUNT);
  const fillActive = downloading || playing || position > 0;

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause" : "Lecture"}
        onPress={toggle}
        scaleTo={0.9}
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.full,
          backgroundColor: incoming
            ? colors.primaryTint
            : "rgba(255,255,255,0.25)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={failed ? "alert-circle-outline" : playing ? "pause" : "play"}
          size={17}
          color={failed ? colors.danger : accent}
          style={{ marginLeft: playing ? 0 : 2 }}
        />
      </PressableScale>

      <View style={{ gap: 5, minWidth: 110 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            height: 20,
          }}
        >
          {bars.map((height, index) => (
            <View
              key={index}
              style={{
                width: 3,
                height,
                borderRadius: radii.full,
                backgroundColor:
                  fillActive && index < filledBars
                    ? downloading
                      ? incoming
                        ? colors.primary
                        : colors.onPrimary
                      : accent
                    : idleColor,
                opacity: downloading
                  ? 0.55 + 0.45 * (index < filledBars ? 1 : 0)
                  : 1,
              }}
            />
          ))}
        </View>
        <AppText
          style={{
            fontSize: 11,
            color: incoming ? colors.textFaint : "rgba(255,255,255,0.8)",
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          }}
        >
          {downloading
            ? `téléchargement… ${Math.round(downloadProgress * 100)} %`
            : failed
              ? "échec — appuyez pour réessayer"
              : `${formatDuration(position)} / ${formatDuration(duration)}`}
        </AppText>
      </View>
    </View>
  );
}
