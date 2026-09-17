import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { colors, layout, radii } from "@/theme";
import { artworkGradient, initials } from "@/utils/format";
import { AppText } from "@/components/ui/primitives";

interface ArtworkProps {
  uri?: string | null;
  seed: string;
  label: string;
  size: number;
  radius?: number;
}

/** Artwork with a deterministic gradient + initials fallback. */
export function Artwork({ uri, seed, label, size, radius = radii.md }: ArtworkProps) {
  const gradient = artworkGradient(seed);
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surface }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: gradient.from,
        },
      ]}
    >
      <AppText style={{ color: "#FFFFFF88", fontSize: Math.max(14, size * 0.3), fontWeight: "800" }}>
        {initials(label) || "♪"}
      </AppText>
    </View>
  );
}

export function ThumbArtwork(props: Omit<ArtworkProps, "size">) {
  return <Artwork {...props} size={layout.artworkThumb} radius={radii.sm} />;
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
