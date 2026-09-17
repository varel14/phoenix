import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useState } from "react";
import { colors, radii, spacing } from "@/theme";
import { AppText } from "./primitives";

export { AppText, Button } from "./primitives";

export function Screen({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
}

export function Input(props: TextInputProps) {
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
          borderRadius: radii.md,
          color: colors.text,
          paddingHorizontal: spacing.md,
          height: 48,
          fontSize: 15,
        },
        props.style,
      ]}
    />
  );
}

interface IconButtonProps {
  glyph: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: object;
}

/** Text-glyph button (no icon font dependency). */
export function IconButton({ glyph, onPress, size = 22, color = colors.text, disabled, accessibilityLabel, style }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [iconButtonBase, style, pressed && { opacity: 0.6 }, disabled && { opacity: 0.4 }]}
    >
      <AppText style={{ fontSize: size, color, lineHeight: size * 1.3 }}>{glyph}</AppText>
    </Pressable>
  );
}

const iconButtonBase = {
  width: 40,
  height: 40,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  borderRadius: radii.full,
};

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={centered}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <AppText variant="bodyMuted" style={{ marginTop: spacing.md }}>{label}</AppText> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={centered}>
      <AppText variant="heading" color={colors.danger}>Something went wrong</AppText>
      <AppText variant="bodyMuted" align="center" style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
        {message ?? "Please check your connection and try again."}
      </AppText>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ marginTop: spacing.lg }}>
          <AppText style={{ color: colors.primary, fontWeight: "700" }}>Try again</AppText>
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
  if (!visible) return null;
  return (
    <View style={{ backgroundColor: colors.warning, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}>
      <AppText style={{ color: "#201500", fontSize: 13, fontWeight: "700" }} align="center">
        You are offline — events will sync automatically
      </AppText>
    </View>
  );
}

export function ProgressBar({ progress, color = colors.primary }: { progress: number; color?: string }) {
  return (
    <View style={{ height: 4, borderRadius: radii.full, backgroundColor: colors.surfaceHighlight, overflow: "hidden" }}>
      <View style={{ height: 4, width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, backgroundColor: color }} />
    </View>
  );
}

/** ⋮ context menu with action rows. */
export interface MenuAction {
  label: string;
  glyph?: string;
  destructive?: boolean;
  onPress: () => void;
}

export function ContextMenu({ actions }: { actions: MenuAction[] }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <IconButton glyph="⋮" onPress={() => setVisible(true)} accessibilityLabel="More options" />
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
              {actions.map((action) => (
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
                  <AppText style={{ fontSize: 18, width: 24, color: action.destructive ? colors.danger : colors.textMuted }}>
                    {action.glyph ?? "•"}
                  </AppText>
                  <AppText style={{ color: action.destructive ? colors.danger : colors.text, fontSize: 15 }}>
                    {action.label}
                  </AppText>
                </Pressable>
              ))}
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

void StyleSheet;
