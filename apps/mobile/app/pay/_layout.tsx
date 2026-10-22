import { Stack } from "expo-router";
import { useTheme } from "@/theme/theme-provider";

/**
 * The pay flow is its own world: screens rise softly into place
 * (fade_from_bottom) instead of the OS slide, send/top-up push up like
 * sheets, and everything keeps one continuous branded backdrop.
 */
export default function PayLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade_from_bottom",
        animationDuration: 340,
        gestureEnabled: true,
        statusBarAnimation: "fade",
      }}
    >
      <Stack.Screen name="send" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="topup" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
