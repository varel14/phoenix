import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale } from "@/components/ui/primitives";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

export interface AttachChoice {
  kind: "photo" | "camera" | "video" | "file";
}

/** Instagram-style attachment tiles, shown in the panel above the composer. */
export function AttachPanel({ onPick, busy }: { onPick: (choice: AttachChoice["kind"]) => void; busy?: boolean }) {
  const { colors } = useTheme();
  const tiles: Array<{ key: AttachChoice["kind"]; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; tint: string }> = [
    { key: "photo", icon: "images-outline", label: "Photo", tint: "#4D9FFF" },
    { key: "camera", icon: "camera-outline", label: "Caméra", tint: colors.primary },
    { key: "video", icon: "videocam-outline", label: "Vidéo", tint: "#FF6B81" },
    { key: "file", icon: "document-outline", label: "Fichier", tint: "#C4A1FF" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {tiles.map((tile) => (
        <PressableScale
          key={tile.key}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={tile.label}
          onPress={() => onPick(tile.key)}
          scaleTo={0.92}
          style={{ alignItems: "center", gap: spacing.xs, width: 72 }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${tile.tint}26`,
            }}
          >
            <Ionicons name={tile.icon} size={24} color={tile.tint} />
          </View>
          <AppText variant="small">{tile.label}</AppText>
        </PressableScale>
      ))}
    </View>
  );
}
