import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { useNetworkState } from "expo-network";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider, useTheme } from "@/theme/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
import { useDownloadsStore } from "@/services/downloads/download-manager";
import { useEventSync } from "@/hooks/use-event-sync";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const isReady = useAuthStore((state) => state.isReady);
  const restore = useAuthStore((state) => state.restore);
  const hydrateDownloads = useDownloadsStore((state) => state.hydrate);
  const networkState = useNetworkState();

  useEventSync();

  // Keep react-query's online state aligned with expo-network.
  useEffect(() => {
    onlineManager.setOnline(networkState?.isConnected ?? true);
  }, [networkState?.isConnected]);

  useEffect(() => {
    void restore().then(() => {
      void hydrateDownloads();
      SplashScreen.hideAsync().catch(() => {});
    });
  }, [restore, hydrateDownloads]);

  if (!isReady) return null;

  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { colors, isDark } = useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
