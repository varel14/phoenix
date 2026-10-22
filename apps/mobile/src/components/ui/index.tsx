import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { AppText, PressableScale } from "./primitives";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export { AppText, Button, PressableScale } from "./primitives";

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
}

/** Floating surface for grouped content: hairline edge + soft drop shadow. */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: object;
  padded?: boolean;
}) {
  const { colors, radii, shadows } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
          boxShadow: shadows.card,
          ...(padded ? { padding: spacing.lg, gap: spacing.xs } : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const { colors, radii } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      autoCapitalize="none"
      {...props}
      style={[
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.md,
          color: colors.text,
          paddingHorizontal: spacing.lg,
          height: 48,
          fontSize: 15,
        },
        props.style,
      ]}
    />
  );
}

/** Legacy text-glyph → Ionicons mapping so existing call sites keep working. */
const GLYPH_MAP: Record<string, IconName> = {
  "▶": "play",
  "❚❚": "pause",
  "▶▶": "play-forward",
  "♥": "heart",
  "♡": "heart-outline",
  "↓": "chevron-down",
  "←": "chevron-back",
  "⌫": "trash-outline",
  "⋮": "ellipsis-vertical",
  "🗑": "trash-outline",
  "✎": "pencil",
  "◉": "person-circle-outline",
  "✕": "close",
  "✓": "checkmark",
  "✔": "checkmark-circle",
  "+": "add",
};

interface IconButtonProps {
  glyph?: string;
  /** Direct Ionicons glyph name (preferred over legacy `glyph`). */
  icon?: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
  /** Renders a persistent tinted disc behind the icon instead of on-press only. */
  tinted?: boolean;
  accessibilityLabel?: string;
  style?: object;
}

export function IconButton({
  glyph,
  icon,
  onPress,
  size = 22,
  color,
  disabled,
  tinted,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  const { colors, radii } = useTheme();
  const name = icon ?? GLYPH_MAP[glyph ?? ""] ?? "ellipse-outline";
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      style={[
        {
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.full,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radii.full,
            backgroundColor: tinted ? colors.primaryTint : "transparent",
          },
        ]}
      />
      <Ionicons name={name} size={size} color={color ?? colors.text} />
    </PressableScale>
  );
}

export function LoadingView({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={centered}>
      <ActivityIndicator color={colors.accent} size="large" />
      {label ? (
        <AppText variant="bodyMuted" style={{ marginTop: spacing.md }}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorView({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={centered}>
      <AppText variant="heading" color={colors.danger}>
        Something went wrong
      </AppText>
      <AppText
        variant="bodyMuted"
        align="center"
        style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl }}
      >
        {message ?? "Please check your connection and try again."}
      </AppText>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ marginTop: spacing.lg }}>
          <AppText style={{ color: colors.accent, fontWeight: "700" }}>
            Try again
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyView({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={centered}>
      <AppText variant="heading">{title}</AppText>
      {subtitle ? (
        <AppText
          variant="bodyMuted"
          align="center"
          style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl }}
        >
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function OfflineBanner({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View
      style={{
        backgroundColor: colors.warning,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
      }}
    >
      <AppText
        style={{ color: "#201500", fontSize: 13, fontWeight: "700" }}
        align="center"
      >
        You are offline — events will sync automatically
      </AppText>
    </View>
  );
}

export function ProgressBar({
  progress,
  color,
}: {
  progress: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 4,
        borderRadius: radii.full,
        backgroundColor: colors.surfaceHighlight,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 4,
          width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
          backgroundColor: color ?? colors.primary,
        }}
      />
    </View>
  );
}

/** ⋮ context menu with action rows. */
export interface MenuAction {
  label: string;
  glyph?: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Instagram-style bottom action sheet. Rendered through a RN `Modal` — an
 * inline absolute overlay would be clipped to the row it is anchored in.
 */
const SHEET_SLIDE_DISTANCE = 360;

export function ContextMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const { colors, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  const close = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 170,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setOpen(false));
  }, [progress]);

  useEffect(() => {
    if (open) {
      Animated.spring(progress, {
        toValue: 1,
        speed: 32,
        bounciness: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [open, progress]);

  return (
    <>
      <IconButton
        icon="ellipsis-vertical"
        onPress={() => setOpen(true)}
        accessibilityLabel="Plus d’options"
      />
      <Modal
        transparent
        visible={open}
        animationType="none"
        onRequestClose={close}
      >
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Fermer le menu">
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: colors.scrim,
              opacity: progress,
              justifyContent: "flex-end",
            }}
          >
            {/* Block presses inside the sheet from dismissing it. */}
            <Pressable onPress={() => {}}>
              <Animated.View
                style={{
                  transform: [
                    {
                      translateY: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [SHEET_SLIDE_DISTANCE, 0],
                      }),
                    },
                  ],
                }}
              >
                <View
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    borderTopLeftRadius: radii.xl,
                    borderTopRightRadius: radii.xl,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.hairline,
                    paddingBottom: insets.bottom + spacing.sm,
                  }}
                >
                  <View
                    style={{
                      alignItems: "center",
                      paddingTop: spacing.sm,
                      paddingBottom: spacing.xs,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 4,
                        borderRadius: radii.full,
                        backgroundColor: colors.surfaceHighlight,
                      }}
                    />
                  </View>
                  {actions.map((action, index) => {
                    const name =
                      action.icon ??
                      GLYPH_MAP[action.glyph ?? ""] ??
                      "ellipse-outline";
                    return (
                      <Pressable
                        key={action.label}
                        accessibilityRole="button"
                        onPress={() => {
                          close();
                          action.onPress();
                        }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.md,
                          paddingHorizontal: spacing.xl,
                          height: 52,
                          borderTopWidth:
                            index === 0 ? 0 : StyleSheet.hairlineWidth,
                          borderTopColor: colors.hairline,
                          backgroundColor: pressed
                            ? colors.surfaceHighlight
                            : "transparent",
                        })}
                      >
                        <Ionicons
                          name={name}
                          size={20}
                          color={
                            action.destructive ? colors.danger : colors.textMuted
                          }
                        />
                        <AppText
                          style={{
                            color: action.destructive
                              ? colors.danger
                              : colors.text,
                            fontSize: 15,
                            fontWeight: action.destructive ? "600" : "400",
                          }}
                        >
                          {action.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    onPress={close}
                    style={({ pressed }) => ({
                      height: 52,
                      alignItems: "center",
                      justifyContent: "center",
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.hairline,
                      backgroundColor: pressed
                        ? colors.surfaceHighlight
                        : "transparent",
                    })}
                  >
                    <AppText
                      style={{
                        color: colors.text,
                        fontSize: 15,
                        fontWeight: "700",
                      }}
                    >
                      Annuler
                    </AppText>
                  </Pressable>
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const centered = {
  flex: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: spacing.xs,
  paddingVertical: spacing.xxl,
};
