/**
 * Shared wallet building blocks: staggered entrances, circular quick actions,
 * glass buttons for the gradient hero, chips, the animated success hero and
 * small summary/status primitives reused across the pay screens.
 */
import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
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

/**
 * Soft brand glow behind every pay screen — the flow's continuous backdrop.
 * Because every screen mounts the exact same glow in the same spot, stack
 * transitions read as one seamless space rather than page swaps.
 */
export function PayBackdrop() {
  const { isDark } = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={
          isDark
            ? [
                "rgba(139, 92, 246, 0.16)",
                "rgba(91, 35, 255, 0.05)",
                "rgba(10, 9, 20, 0)",
              ]
            : [
                "rgba(139, 92, 246, 0.09)",
                "rgba(91, 35, 255, 0.03)",
                "rgba(247, 245, 252, 0)",
              ]
        }
        locations={[0, 0.55, 1]}
        style={{ height: 280 }}
      />
    </View>
  );
}

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
      style={{ width: 64, alignItems: "center", gap: spacing.xs }}
    >
      {highlighted ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[circle(46), { boxShadow: glows.brand }]}
        >
          <Ionicons name={icon} size={19} color={colors.onPrimary} />
        </LinearGradient>
      ) : (
        <View
          style={[
            circle(46),
            {
              backgroundColor: colors.surfaceElevated,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairline,
            },
          ]}
        >
          <Ionicons name={icon} size={18} color={colors.text} />
        </View>
      )}
      <AppText variant="caption" numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

/**
 * White pill action sitting on the gradient hero — the reference wallet's
 * "Add Money / Move" treatment: solid white, near-black content, soft shadow.
 */
export function GlassButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.96} style={{ flex: 1 }}>
      <View
        style={{
          height: 46,
          borderRadius: radii.full,
          backgroundColor: "#FFFFFF",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          boxShadow: "0 6px 18px rgba(0, 0, 0, 0.28)",
        }}
      >
        <Ionicons name={icon} size={17} color="#0A0A0A" />
        <AppText style={{ color: "#0A0A0A", fontSize: 15, fontWeight: "700" }}>
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
      <AppText variant="subheading" style={{ flex: 1 }}>
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
  size = 44,
  onPress,
}: {
  id: string;
  name: string;
  image: string | null;
  size?: number;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      accessibilityLabel={`Envoyer à ${name}`}
      style={{ width: size + 16, alignItems: "center", gap: spacing.xs }}
    >
      <UserAvatar user={{ id, name, image }} size={size} />
      <AppText
        variant="caption"
        numberOfLines={1}
        style={{ maxWidth: size + 12, textAlign: "center" }}
      >
        {name.split(/\s+/)[0]}
      </AppText>
    </PressableScale>
  );
}

/** Springy result banner: check disc, overline title, amount, message. */
export function SuccessHero({
  title,
  amountText,
  amountColor,
  message,
  tone = "success",
}: {
  title: string;
  amountText: string;
  amountColor: string;
  message?: string;
  tone?: "success" | "danger";
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.3)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const disc = tone === "success" ? colors.success : colors.danger;

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

  const { colors: _themeColors, gradients: themeGradients } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {tone === "success" ? (
          <LinearGradient
            colors={themeGradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              circle(84),
              {
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 10px 28px ${withAlpha(themeGradients.brand[1], 0.4)}`,
              },
            ]}
          >
            <Ionicons name="checkmark" size={40} color="#FFFFFF" />
          </LinearGradient>
        ) : (
          <View
            style={[
              circle(84),
              {
                backgroundColor: disc,
                boxShadow: `0 10px 28px ${withAlpha(disc, 0.35)}`,
              },
            ]}
          >
            <Ionicons name="close" size={40} color="#FFFFFF" />
          </View>
        )}
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

/** Sender → recipient summary with avatars, used on result screens. */
export function PeerFlow({
  from,
  to,
}: {
  from: { id: string; name: string; image: string | null };
  to: { id: string; name: string; image: string | null };
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          gap: 2,
        }}
      >
        <UserAvatar user={from} size={44} />
        <AppText
          variant="caption"
          color={colors.textMuted}
          numberOfLines={1}
          style={{ maxWidth: 104 }}
        >
          {from.name}
        </AppText>
        <AppText variant="small" color={colors.textFaint}>
          Expéditeur
        </AppText>
      </View>
      <Ionicons
        name="arrow-forward"
        size={18}
        color={colors.textFaint}
        style={{ marginHorizontal: spacing.sm }}
      />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          gap: 2,
        }}
      >
        <UserAvatar user={to} size={44} />
        <AppText
          variant="caption"
          color={colors.textMuted}
          numberOfLines={1}
          style={{ maxWidth: 104 }}
        >
          {to.name}
        </AppText>
        <AppText variant="small" color={colors.textFaint}>
          Bénéficiaire
        </AppText>
      </View>
    </View>
  );
}

/**
 * Custom numeric keypad for amount entry (no system keyboard): digits,
 * a "000" key for fast FCFA entry, and backspace.
 */
export function AmountKeyboard({
  onDigit,
  onDelete,
  style,
}: {
  onDigit: (digits: string) => void;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  const key = (
    label: string,
    onPress: () => void,
    options?: { icon?: boolean; accessibilityLabel?: string },
  ) => (
    <PressableScale
      key={label}
      onPress={onPress}
      scaleTo={0.94}
      accessibilityLabel={options?.accessibilityLabel ?? `Touche ${label}`}
      style={{
        flexBasis: "30%",
        height: 64,
        borderRadius: radii.lg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {options?.icon ? (
        <Ionicons name="backspace-outline" size={24} color={colors.textMuted} />
      ) : (
        <AppText
          style={{
            fontSize: label.length > 1 ? 18 : 28,
            fontWeight: "500",
            color: colors.text,
            fontVariant: ["tabular-nums"],
          }}
        >
          {label}
        </AppText>
      )}
    </PressableScale>
  );

  return (
    <View
      style={[
        {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: spacing.md,
        },
        style,
      ]}
    >
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) =>
        key(digit, () => onDigit(digit)),
      )}
      {key("000", () => onDigit("000"), { accessibilityLabel: "Trois zéros" })}
      {key("0", () => onDigit("0"))}
      {key("⌫", onDelete, { icon: true, accessibilityLabel: "Effacer" })}
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

/**
 * Compact follow toggle: "Suivre" (filled), "Suivi" (tinted) or "Mutuel"
 * (success tint) — the payment partner badge used in the send list and on
 * transaction detail.
 */
export function FollowButton({
  isFollowing,
  isMutual,
  loading,
  onPress,
}: {
  isFollowing: boolean;
  isMutual: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const meta = !isFollowing
    ? {
        label: "Suivre",
        icon: "person-add-outline" as const,
        background: colors.primary,
        tint: colors.onPrimary,
      }
    : isMutual
      ? {
          label: "Mutuel",
          icon: "people-outline" as const,
          background: withAlpha(colors.success, 0.14),
          tint: colors.success,
        }
      : {
          label: "Suivi",
          icon: "checkmark" as const,
          background: colors.primaryTint,
          tint: colors.primary,
        };

  return (
    <PressableScale
      onPress={onPress}
      disabled={loading}
      scaleTo={0.96}
      hitSlop={6}
      accessibilityLabel={
        isFollowing ? `Ne plus suivre — ${meta.label}` : meta.label
      }
    >
      <View
        style={{
          height: 30,
          paddingHorizontal: spacing.md,
          borderRadius: radii.full,
          backgroundColor: meta.background,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={meta.tint} />
        ) : (
          <Ionicons name={meta.icon} size={13} color={meta.tint} />
        )}
        <AppText style={{ color: meta.tint, fontSize: 12, fontWeight: "700" }}>
          {meta.label}
        </AppText>
      </View>
    </PressableScale>
  );
}
