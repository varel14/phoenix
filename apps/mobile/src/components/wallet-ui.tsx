/**
 * Shared wallet building blocks: staggered entrances, circular quick actions,
 * glass buttons for the gradient hero, chips, the animated success hero and
 * small summary/status primitives reused across the pay screens.
 */
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PressableScale } from "@/components/ui";
import { UserAvatar } from "@/components/chat/user-avatar";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import type { WalletTransactionStatus } from "@/types/wallet";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Entrance helper: fade + slight rise. Stagger siblings via `delay` (ms). */
export function FadeIn({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        speed: 32,
        bounciness: 4,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function circle(diameter: number) {
  return {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

/** Circular action button with caption — the pay hub's primary shortcuts. */
export function QuickAction({
  icon,
  label,
  onPress,
  highlighted,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  highlighted?: boolean;
}) {
  const { colors, gradients, glows } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      accessibilityLabel={label}
      style={{ width: 76, alignItems: "center", gap: spacing.xs }}
    >
      {highlighted ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[circle(58), { boxShadow: glows.brand }]}
        >
          <Ionicons name={icon} size={24} color={colors.onPrimary} />
        </LinearGradient>
      ) : (
        <View
          style={[
            circle(58),
            {
              backgroundColor: colors.surfaceElevated,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairline,
            },
          ]}
        >
          <Ionicons name={icon} size={22} color={colors.text} />
        </View>
      )}
      <AppText variant="caption" numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

/** Translucent white pill used for actions sitting on the gradient card. */
export function GlassButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} scaleTo={0.96} style={{ flex: 1 }}>
      <View
        style={{
          height: 44,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: withAlpha(colors.onPrimary, 0.32),
          backgroundColor: withAlpha(colors.onPrimary, 0.16),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
        }}
      >
        <Ionicons name={icon} size={17} color={colors.onPrimary} />
        <AppText
          style={{ color: colors.onPrimary, fontSize: 15, fontWeight: "600" }}
        >
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

/** Pill chip for amount presets and transaction filters. */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      hitSlop={6}
      style={{
        height: 36,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <AppText
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: active ? colors.onPrimary : colors.textMuted,
        }}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}

/** Section title with an optional trailing text action ("Tout voir"). */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
      }}
    >
      <AppText variant="heading" style={{ flex: 1 }}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onAction}>
          <AppText
            variant="small"
            color={colors.accent}
            style={{ fontWeight: "700" }}
          >
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Contact avatar rail item — "Envoi rapide" on the hub and send screens. */
export function QuickRecipient({
  id,
  name,
  image,
  onPress,
}: {
  id: string;
  name: string;
  image: string | null;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      accessibilityLabel={`Envoyer à ${name}`}
      style={{ width: 68, alignItems: "center", gap: spacing.xs }}
    >
      <UserAvatar user={{ id, name, image }} size={56} />
      <AppText
        variant="caption"
        numberOfLines={1}
        style={{ maxWidth: 64, textAlign: "center" }}
      >
        {name.split(/\s+/)[0]}
      </AppText>
    </PressableScale>
  );
}

/** Springy success banner: check disc, overline title, amount, message. */
export function SuccessHero({
  title,
  amountText,
  amountColor,
  message,
}: {
  title: string;
  amountText: string;
  amountColor: string;
  message?: string;
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.3)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 20,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      delay: 90,
      useNativeDriver: true,
    }).start();
  }, [scale, fade]);

  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          style={[
            circle(84),
            {
              backgroundColor: colors.success,
              boxShadow: `0 10px 28px ${withAlpha(colors.success, 0.35)}`,
            },
          ]}
        >
          <Ionicons name="checkmark" size={40} color="#FFFFFF" />
        </View>
      </Animated.View>
      <Animated.View
        style={{ opacity: fade, alignItems: "center", gap: spacing.xs }}
      >
        <AppText
          variant="small"
          color={colors.textFaint}
          style={{ letterSpacing: 1.5 }}
        >
          {title.toUpperCase()}
        </AppText>
        <AppText
          style={{
            fontSize: 34,
            fontWeight: "800",
            letterSpacing: -0.5,
            color: amountColor,
            fontVariant: ["tabular-nums"],
          }}
        >
          {amountText}
        </AppText>
        {message ? (
          <AppText variant="bodyMuted" align="center">
            {message}
          </AppText>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Label/value line inside detail + receipt cards. */
export function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: spacing.lg,
      }}
    >
      <AppText variant="bodyMuted">{label}</AppText>
      <AppText
        style={{
          fontWeight: "600",
          flexShrink: 1,
          textAlign: "right",
          fontVariant: ["tabular-nums"],
          color: valueColor ?? colors.text,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

const STATUS_META: Record<
  WalletTransactionStatus,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  SUCCESS: { label: "Succès", tone: "success" },
  PENDING: { label: "En attente", tone: "warning" },
  FAILED: { label: "Échoué", tone: "danger" },
};

/** Colored status pill (Succès / En attente / Échoué). */
export function StatusChip({ status }: { status: WalletTransactionStatus }) {
  const { colors } = useTheme();
  const meta = STATUS_META[status];
  const tint =
    meta.tone === "success"
      ? colors.success
      : meta.tone === "warning"
        ? colors.warning
        : colors.danger;
  return (
    <View
      style={{
        height: 26,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        backgroundColor: withAlpha(tint, 0.14),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText variant="small" style={{ color: tint, letterSpacing: 0.3 }}>
        {meta.label}
      </AppText>
    </View>
  );
}
