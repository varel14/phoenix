import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/theme/theme-provider";

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  const { colors } = useTheme();

  if (user) {
    return <Redirect href="/(tabs)" />;
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
