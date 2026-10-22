import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text as RNText,
  View,
  type TextProps as RNTextProps,
} from "react-native";
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

export function AppText({
  variant = "body",
  color,
  align,
  style,
  ...rest
}: AppTextProps) {
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

interface PressableScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Scale applied while pressed — 0.96 is the sweet spot; below 0.95 feels exaggerated. */
  scaleTo?: number;
  hitSlop?: number;
  accessibilityRole?: "button" | "none";
  accessibilityLabel?: string;
  /** Same signature as Pressable's style: object or ({ pressed }) => object. */
  style?: object | ((state: { pressed: boolean }) => object);
  children?: React.ReactNode;
}

/**
 * Pressable with a springy, interruptible scale response. The spring keeps
 * running across rapid tap/release cycles instead of snapping between states.
 */
export function PressableScale({
  onPress,
  onLongPress,
  disabled,
  scaleTo = 0.97,
  hitSlop,
  accessibilityRole = "button",
  accessibilityLabel,
  style,
  children,
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      speed: 40,
      bounciness: 5,
      useNativeDriver: true,
    }).start();

  const resolvedStyle =
    typeof style === "function" ? style({ pressed }) : style;

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        setPressed(true);
        springTo(disabled ? 1 : scaleTo);
      }}
      onPressOut={() => {
        setPressed(false);
        springTo(1);
      }}
    >
      <Animated.View style={[resolvedStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
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

/** Buttons follow the mockup: primary = violet brand-gradient pill, others tinted. */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  const { colors, gradients, radii, glows } = useTheme();
  const inactive = disabled || loading;

  const iconNode = icon ? (
    <Ionicons
      name={icon}
      size={17}
      color={
        variant === "primary"
          ? "#FFFFFF"
          : variant === "danger"
            ? "#FFFFFF"
            : variant === "ghost"
              ? colors.primary
              : colors.text
      }
    />
  ) : null;

  const labelNode = (
    <RNText
      style={{
        ...(variant === "secondary"
          ? { color: colors.text, fontWeight: "600" }
          : {}),
        ...(variant === "danger"
          ? { color: "#FFFFFF", fontWeight: "700" }
          : {}),
        ...(variant === "ghost"
          ? { color: colors.primary, fontWeight: "600" }
          : {}),
        ...(variant === "primary"
          ? { color: "#FFFFFF", fontWeight: "700" }
          : {}),
        fontSize: 16,
      }}
    >
      {label}
    </RNText>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      scaleTo={0.96}
      style={[
        {
          height: 48,
          borderRadius: radii.md,
          ...(variant === "primary"
            ? { boxShadow: glows.brand }
            : {
                backgroundColor:
                  variant === "secondary"
                    ? colors.primaryTint
                    : variant === "danger"
                      ? colors.danger
                      : "transparent",
                borderWidth: variant === "secondary" ? 1 : 0,
                borderColor:
                  variant === "secondary" ? colors.border : undefined,
              }),
          opacity: inactive ? 0.5 : 1,
        },
        style,
      ]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ ...buttonBase, borderRadius: radii.md }}
        >
          <View style={row}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              iconNode
            )}
            {labelNode}
          </View>
        </LinearGradient>
      ) : (
        <View style={[row, { height: "100%", paddingHorizontal: 24 }]}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={variant === "danger" ? "#FFFFFF" : colors.primary}
            />
          ) : (
            iconNode
          )}
          {labelNode}
        </View>
      )}
    </PressableScale>
  );
}

const buttonBase = {
  height: 48,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 24,
};

const row = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
};
