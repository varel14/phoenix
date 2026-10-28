import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/theme/theme-provider";
import { mmkv } from "@/services/storage/mmkv";
import { ONBOARDING_COMPLETE_KEY } from "@/constants/onboarding";

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  const { colors } = useTheme();

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  // First launch: the welcome slides come before any sign-in screen.
  if (!mmkv.getBoolean(ONBOARDING_COMPLETE_KEY)) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
