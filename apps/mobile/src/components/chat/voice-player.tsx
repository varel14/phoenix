import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { AppText } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import { API_URL } from "@/services/api/api-client";
import type { MessageAttachment } from "@/types/chat";

interface VoicePlayerProps {
  attachment: MessageAttachment;
  incoming: boolean;
}

/** Play/pause control + progress for a voice message bubble. */
export function VoicePlayer({ attachment, incoming }: VoicePlayerProps) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const duration = attachment.durationSec ?? 0;

  const sourceUri = attachment.url.startsWith("http") ? attachment.url : `${API_URL}${attachment.url}`;
  const player = useAudioPlayer({ uri: sourceUri });
  const finishedRef = useRef(false);

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

  function toggle() {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  }

  const accent = incoming ? colors.primary : colors.onPrimary;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause" : "Lecture"}
        onPress={toggle}
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.full,
          backgroundColor: incoming ? colors.primaryTint : "rgba(255,255,255,0.25)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={playing ? "pause" : "play"} size={18} color={accent} />
      </Pressable>

      <View style={{ gap: 4, minWidth: 120 }}>
        <View
          style={{
            height: 4,
            borderRadius: radii.full,
            backgroundColor: incoming ? colors.surfaceHighlight : "rgba(255,255,255,0.3)",
            overflow: "hidden",
          }}
        >
          <View style={{ height: 4, width: `${Math.round(progress * 100)}%`, backgroundColor: accent }} />
        </View>
        <AppText style={{ fontSize: 11, color: incoming ? colors.textFaint : "rgba(255,255,255,0.75)", fontWeight: "600" }}>
          {formatDuration(duration)}
        </AppText>
      </View>
    </View>
  );
}
