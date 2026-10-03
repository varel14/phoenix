import { Pressable, Text as RNText, View, type TextProps as RNTextProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { typography, variantColor, type Variant } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

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
  /** Optional Ionicons glyph rendered before the label. */
  icon?: IconName;
  style?: object;
}

/** Buttons follow the mockup: primary = purple→pink gradient pill, others tinted. */
export function Button({ label, onPress, variant = "primary", disabled, loading, icon, style }: ButtonProps) {
  const { colors, gradients, radii } = useTheme();

  const iconNode = icon ? (
    <Ionicons name={icon} size={17} color={variant === "primary" ? colors.onPrimary : variant === "danger" ? "#FFFFFF" : variant === "ghost" ? colors.primary : colors.text} />
  ) : null;

  const content = (
    <>
      {variant === "primary" ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ ...buttonBase, borderRadius: radii.full, ...(style as object) }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {iconNode}
            <RNText style={{ color: colors.onPrimary, fontSize: 16, fontWeight: "700" }}>
              {loading ? "Please wait…" : label}
            </RNText>
          </View>
        </LinearGradient>
      ) : null}
      {variant !== "primary" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {iconNode}
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
        </View>
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
