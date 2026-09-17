import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/stores/auth-store";
import { colors } from "@/theme";

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);

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
