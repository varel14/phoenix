import { View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { glows, radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { AppText } from "./primitives";

/** Gradient brand tile with the headphone mark (no wordmark). */
export function PhoenixMark({ size = 88 }: { size?: number }) {
  const { colors, gradients } = useTheme();
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: glows.brand,
      }}
    >
      <HeadphoneMark size={size * 0.6} color={colors.onPrimary} />
    </LinearGradient>
  );
}

/** Brand mark + wordmark, used on splash-like marketing surfaces. */
export function PhoenixLogo({ size = 88 }: { size?: number }) {
  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <PhoenixMark size={size} />
      <AppText variant="title" style={{ letterSpacing: 2 }}>
        CHUYASSI EMMANUEL CE
      </AppText>
    </View>
  );
}

/**
 * Hand-drawn headphone mark: a rounded headband arc over two pill ear cups.
 * Built from plain Views so it stays crisp at any size with no SVG dependency.
 */
function HeadphoneMark({ size, color }: { size: number; color: string }) {
  const band = size * 0.14; // headband stroke thickness
  const arc = size / 2; // half-circle headband height
  const cupWidth = size * 0.28;
  const cupHeight = size * 0.42;
  const tuck = band * 0.4; // how far each cup reaches up into the band end
  const cup: ViewStyle = {
    position: "absolute",
    top: arc - tuck,
    width: cupWidth,
    height: cupHeight,
    borderRadius: cupWidth / 2,
    backgroundColor: color,
  };
  return (
    <View style={{ width: size, height: arc + cupHeight - tuck }}>
      <View
        style={{
          width: size,
          height: arc,
          borderWidth: band,
          borderBottomWidth: 0,
          borderTopLeftRadius: arc,
          borderTopRightRadius: arc,
          borderColor: color,
        }}
      />
      <View style={[cup, { left: 0 }]} />
      <View style={[cup, { right: 0 }]} />
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
