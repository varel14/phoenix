import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { AppText } from "./primitives";

/** Gradient brand mark + wordmark, used on auth and empty marketing surfaces. */
export function PhoenixLogo({ size = 88 }: { size?: number }) {
  const { colors, gradients } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="musical-notes" size={size * 0.5} color={colors.onPrimary} />
      </LinearGradient>
      <AppText variant="title" style={{ letterSpacing: 2 }}>
        CHUYASSI EMMANUEL CE
      </AppText>
    </View>
  );
}

/** Tagline line under the logo, per the mockup splash. */
export function BrandTagline() {
  return (
    <AppText variant="bodyMuted" align="center">
      Tout votre univers au même endroit
    </AppText>
  );
}
