import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { radii } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import { AppText } from "@/components/ui";

interface VoicePreviewProps {
  uri: string;
  durationSec: number;
}

/**
 * WhatsApp-style pre-send check: play/pause the just-recorded clip, watch the
 * progress, then decide below (trash = withdraw, send = ship it).
 */
export function VoicePreview({ uri, durationSec }: VoicePreviewProps) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const finishedRef = useRef(false);
  const player = useAudioPlayer({ uri });

  useEffect(() => {
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      setPosition(status.currentTime);
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

  const total = durationSec || Math.round(player.duration || 0);
  const progress = total > 0 ? Math.min(1, position / total) : 0;

  function toggle() {
    if (playing) {
      player.pause();
    } else {
      if (finishedRef.current) {
        finishedRef.current = false;
        player.seekTo(0);
      }
      player.play();
    }
  }

  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: 24,
        paddingHorizontal: 12,
        height: 48,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Écouter — mettre en pause" : "Écouter l'enregistrement"}
        onPress={toggle}
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.accent,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name={playing ? "pause" : "play"} size={17} color={colors.onPrimary} style={{ marginLeft: playing ? 0 : 1.5 }} />
      </Pressable>
      {/* Seek bar — tap to scrub */}
      <Pressable
        accessibilityLabel="Position de lecture"
        onPress={(event) => {
          const width = event.nativeEvent.locationX;
          if (total > 0) void player.seekTo((width / 220) * total);
        }}
        style={{ flex: 1, height: 24, justifyContent: "center" }}
      >
        <View style={{ height: 4, borderRadius: radii.full, backgroundColor: colors.surfaceHighlight, overflow: "hidden" }}>
          <View style={{ height: 4, borderRadius: radii.full, width: `${Math.round(progress * 100)}%`, backgroundColor: colors.accent }} />
        </View>
      </Pressable>
      <View style={{ minWidth: 74, alignItems: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="mic" size={12} color={colors.danger} />
          <View style={{ flexDirection: "row", gap: 1 }}>
            <View style={{ width: 3, height: 12, borderRadius: 2, backgroundColor: colors.accent, opacity: playing ? 1 : 0.45 }} />
            <View style={{ width: 3, height: 12, borderRadius: 2, backgroundColor: colors.accent, opacity: playing ? 0.55 : 0.75 }} />
            <View style={{ width: 3, height: 12, borderRadius: 2, backgroundColor: colors.accent, opacity: playing ? 0.85 : 0.5 }} />
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Ionicons name="time-outline" size={11} color={colors.textFaint} />
          <AppText variant="small" style={{ fontVariant: ["tabular-nums"], color: colors.text }}>
            {formatDuration(position)}
          </AppText>
          <AppText variant="small" style={{ fontVariant: ["tabular-nums"] }}>
            / {formatDuration(total)}
          </AppText>
        </View>
      </View>
    </View>
  );
}
