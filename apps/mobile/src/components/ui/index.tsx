import { ActivityIndicator, Pressable, TextInput, View, type TextInputProps } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { AppText } from "./primitives";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export { AppText, Button } from "./primitives";

export function Screen({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
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
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.full,
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
  accessibilityLabel,
  style,
}: IconButtonProps) {
  const { colors, radii } = useTheme();
  const name = icon ?? GLYPH_MAP[glyph ?? ""] ?? "ellipse-outline";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.full,
        },
        style,
        pressed && { opacity: 0.6 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

export function LoadingView({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={centered}>
      <ActivityIndicator color={colors.accent} size="large" />
      {label ? <AppText variant="bodyMuted" style={{ marginTop: spacing.md }}>{label}</AppText> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={centered}>
      <AppText variant="heading" color={colors.danger}>Something went wrong</AppText>
      <AppText variant="bodyMuted" align="center" style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
        {message ?? "Please check your connection and try again."}
      </AppText>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ marginTop: spacing.lg }}>
          <AppText style={{ color: colors.accent, fontWeight: "700" }}>Try again</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyView({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={centered}>
      <AppText variant="heading">{title}</AppText>
      {subtitle ? (
        <AppText variant="bodyMuted" align="center" style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
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
    <View style={{ backgroundColor: colors.warning, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}>
      <AppText style={{ color: "#201500", fontSize: 13, fontWeight: "700" }} align="center">
        You are offline — events will sync automatically
      </AppText>
    </View>
  );
}

export function ProgressBar({ progress, color }: { progress: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 4, borderRadius: radii.full, backgroundColor: colors.surfaceHighlight, overflow: "hidden" }}>
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

export function ContextMenu({ actions }: { actions: MenuAction[] }) {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();

  return (
    <>
      <IconButton icon="ellipsis-vertical" onPress={() => setVisible(true)} accessibilityLabel="More options" />
      {visible ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.scrim,
            zIndex: 100,
            justifyContent: "center",
            paddingHorizontal: spacing.xl,
          }}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: radii.lg, paddingVertical: spacing.sm }}>
              {actions.map((action) => {
                const name = action.icon ?? GLYPH_MAP[action.glyph ?? ""] ?? "ellipse-outline";
                return (
                  <Pressable
                    key={action.label}
                    onPress={() => {
                      setVisible(false);
                      action.onPress();
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: pressed ? colors.surfaceHighlight : "transparent",
                    })}
                  >
                    <Ionicons
                      name={name}
                      size={20}
                      color={action.destructive ? colors.danger : colors.textMuted}
                    />
                    <AppText style={{ color: action.destructive ? colors.danger : colors.text, fontSize: 15 }}>
                      {action.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      ) : null}
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
