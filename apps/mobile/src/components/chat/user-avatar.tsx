import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { AppText } from "@/components/ui";
import { radii } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { profileGradient } from "@/utils/format";
import { resolveAssetUrl } from "@/services/api/api-client";
import type { ConversationUser } from "@/types/chat";

interface UserAvatarProps {
  user: Pick<ConversationUser, "id" | "name" | "image">;
  size?: number;
}

/**
 * Contact avatar: the account's personal photo when one is set, otherwise
 * initials over a deterministic brand-violet gradient.
 */
export function UserAvatar({ user, size = 48 }: UserAvatarProps) {
  const { colors, isDark } = useTheme();
  const radius = size / 2;

  if (user.image) {
    return (
      <Image
        source={{ uri: resolveAssetUrl(user.image) }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: StyleSheet.hairlineWidth,
          // Pure black/white outline (never tinted) so photo edges stay crisp on any surface.
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
        }}
        contentFit="cover"
      />
    );
  }

  const { from, to } = profileGradient(user.id);
  const initials = user.name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText
        style={{ color: "#FFFFFF", fontSize: size * 0.36, fontWeight: "700" }}
      >
        {initials}
      </AppText>
    </LinearGradient>
  );
}

/** Small badge used for call-type indicators. */
export function AvatarOnlineDot() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 12,
        height: 12,
        borderRadius: radii.full,
        backgroundColor: colors.success,
        borderWidth: 2,
        borderColor: colors.background,
      }}
    />
  );
}
