import { useEffect, useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { layout, radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import { playerService } from "@/services/media/player-service";
import { selectCurrentSong, usePlayerStore } from "@/stores/player-store";
import { AppText, IconButton } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";

/** Horizontal drag past this distance (or a fast fling) dismisses the player. */
const DISMISS_DISTANCE = 120;

/** Global mini player docked above the tab bar; opens Now Playing on tap and
 * swipes away horizontally — dismissing it also stops playback. */
export function MiniPlayer() {
  const router = useRouter();
  const { colors, gradients, shadows } = useTheme();
  const song = usePlayerStore(selectCurrentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const status = usePlayerStore((state) => state.status);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);

  const pan = useRef(new Animated.ValueXY()).current;
  const dragOrigin = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      // Let taps through (play button, body press) — claim only horizontal drags.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
      onPanResponderGrant: () => {
        dragOrigin.current = (pan.x as any).__getValue() as number;
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({ x: dragOrigin.current + gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        const x = (pan.x as any).__getValue() as number;
        const flung = Math.abs(gesture.vx) > 1.1;
        if (Math.abs(x) > DISMISS_DISTANCE || flung) {
          // Swipe away: fly off-screen, then stop — the component unmounts.
          Animated.timing(pan, {
            toValue: { x: x >= 0 ? 560 : -560, y: 0 },
            duration: 170,
            useNativeDriver: true,
          }).start(() => {
            playerService.stop();
            pan.setValue({ x: 0, y: 0 });
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            speed: 30,
            bounciness: 6,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // A new track must never inherit the previous drag position.
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [pan, song?.id]);

  const opacity = pan.x.interpolate({
    inputRange: [-320, 0, 320],
    outputRange: [0.35, 1, 0.35],
    extrapolate: "clamp",
  });

  if (!song || status === "idle") return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <Animated.View
      style={{
        transform: [{ translateX: pan.x }, { translateY: pan.y }],
        opacity,
      }}
      {...panResponder.panHandlers}
    >
      <View
        style={{
          backgroundColor: colors.playerBar,
          borderRadius: radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
          boxShadow: shadows.float,
          overflow: "hidden",
        }}
      >
        {/* Brand-gradient progress line across the top of the bar. */}
        <View style={{ height: 3, backgroundColor: colors.surfaceHighlight }}>
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 3,
              width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/song/${song.id}`)}
          style={({ pressed }) => [
            {
              height: layout.miniPlayerHeight,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.md,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Artwork
            uri={song.thumbnailUrl}
            seed={song.id}
            label={song.title}
            size={44}
            radius={radii.sm}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="subheading"
              numberOfLines={1}
              style={{ fontSize: 14 }}
            >
              {song.title}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {song.artist.name} · {formatDuration(currentTime)} /{" "}
              {formatDuration(duration)}
            </AppText>
          </View>
          {/* Brand-gradient play disc — the signature control of the mini player. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
            onPress={() => playerService.togglePlay()}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: radii.full,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color={colors.onPrimary}
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            </LinearGradient>
          </Pressable>
          <IconButton
            icon="play-skip-forward"
            size={18}
            color={colors.textMuted}
            onPress={() => playerService.next()}
            accessibilityLabel="Next"
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}
