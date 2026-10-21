import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { layout, radii } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { artworkGradient, initials } from "@/utils/format";
import { AppText } from "@/components/ui/primitives";
import { resolveAssetUrl } from "@/services/api/api-client";

interface ArtworkProps {
  uri?: string | null;
  seed: string;
  label: string;
  size: number;
  radius?: number;
}

/** Artwork with a deterministic gradient + initials fallback. */
export function Artwork({ uri, seed, label, size, radius = radii.md }: ArtworkProps) {
  const { colors, isDark } = useTheme();
  const gradient = artworkGradient(seed);
  if (uri) {
    return (
      <Image
        source={{ uri: resolveAssetUrl(uri) }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: colors.surface,
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          },
        ]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <LinearGradient
      colors={[gradient.from, gradient.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}
    >
      <AppText style={{ color: "#FFFFFFB3", fontSize: Math.max(14, size * 0.3), fontWeight: "800" }}>
        {initials(label) || "♪"}
      </AppText>
    </LinearGradient>
  );
}

export function ThumbArtwork(props: Omit<ArtworkProps, "size">) {
  return <Artwork {...props} size={layout.artworkThumb} radius={radii.sm} />;
}

const styles = StyleSheet.create({
  image: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
