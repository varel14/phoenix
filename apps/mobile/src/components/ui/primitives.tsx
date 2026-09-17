import { Pressable, StyleSheet, Text as RNText, type TextProps as RNTextProps } from "react-native";
import { colors, typography } from "@/theme";

type Variant = keyof typeof typography;

interface AppTextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  align?: "left" | "center" | "right";
  numberOfLines?: number;
}

export function AppText({ variant = "body", color, align, style, ...rest }: AppTextProps) {
  const base = typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        base,
        align ? { textAlign: align } : undefined,
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

export function Button({ label, onPress, variant = "primary", disabled, loading, style }: ButtonProps) {
  const styles = buttonStyles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        buttonBase,
        styles,
        pressed && !disabled && { opacity: 0.8 },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      <RNText style={buttonLabelByVariant[variant]}>{loading ? "Please wait…" : label}</RNText>
    </Pressable>
  );
}

const buttonBase = {
  height: 48,
  borderRadius: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 20,
};

const buttonStyles = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: "transparent" },
} as const;

const buttonLabelByVariant = {
  primary: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" as const },
  secondary: { color: colors.text, fontSize: 16, fontWeight: "600" as const },
  danger: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" as const },
  ghost: { color: colors.primary, fontSize: 16, fontWeight: "600" as const },
};
