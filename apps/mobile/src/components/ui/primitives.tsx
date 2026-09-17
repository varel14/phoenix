import { Pressable, Text as RNText, type TextProps as RNTextProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { typography, variantColor, type Variant } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

interface AppTextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  align?: "left" | "center" | "right";
  numberOfLines?: number;
}

export function AppText({ variant = "body", color, align, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const base = typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        base,
        align ? { textAlign: align } : undefined,
        { color: colors[variantColor[variant]] },
        color ? { color } : undefined,
        style,
      ]}
    />
  );
}

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: object;
}

/** Buttons follow the mockup: primary = purple→pink gradient pill, others tinted. */
export function Button({ label, onPress, variant = "primary", disabled, loading, style }: ButtonProps) {
  const { colors, gradients, radii } = useTheme();

  const content = (
    <>
      {variant === "primary" ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ ...buttonBase, borderRadius: radii.full, ...(style as object) }}
        >
          <RNText style={{ color: colors.onPrimary, fontSize: 16, fontWeight: "700" }}>
            {loading ? "Please wait…" : label}
          </RNText>
        </LinearGradient>
      ) : null}
      {variant !== "primary" ? (
        <RNText
          style={{
            ...(variant === "secondary" ? { color: colors.text, fontWeight: "600" } : {}),
            ...(variant === "danger" ? { color: "#FFFFFF", fontWeight: "700" } : {}),
            ...(variant === "ghost" ? { color: colors.primary, fontWeight: "600" } : {}),
            fontSize: 16,
          }}
        >
          {loading ? "Please wait…" : label}
        </RNText>
      ) : null}
    </>
  );

  const wrapperStyle =
    variant === "primary"
      ? { opacity: disabled || loading ? 0.5 : 1 }
      : {
          ...buttonBase,
          borderRadius: radii.full,
          backgroundColor:
            variant === "secondary" ? colors.primaryTint : variant === "danger" ? colors.danger : "transparent",
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: variant === "secondary" ? colors.border : undefined,
          opacity: disabled || loading ? 0.5 : 1,
          ...(style as object),
        };

  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={wrapperStyle}>
      {content}
    </Pressable>
  );
}

const buttonBase = {
  height: 48,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 24,
};
