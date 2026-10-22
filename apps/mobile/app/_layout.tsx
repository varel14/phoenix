import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { useNetworkState } from "expo-network";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider, useTheme } from "@/theme/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
import { useDownloadsStore } from "@/services/downloads/download-manager";
import { useEventSync } from "@/hooks/use-event-sync";
import { useRealtime } from "@/hooks/use-realtime";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { CallOverlay } from "@/components/calls/call-overlay";

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

// The provider must sit above every hook that touches the query cache,
// including useRealtime in AppBootstrap below.
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppBootstrap />
    </QueryClientProvider>
  );
}

function AppBootstrap() {
  const isReady = useAuthStore((state) => state.isReady);
  const restore = useAuthStore((state) => state.restore);
  const hydrateDownloads = useDownloadsStore((state) => state.hydrate);
  const networkState = useNetworkState();

  useEventSync();
  useRealtime();
  usePushNotifications();

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
        <KeyboardProvider>
          <StatusBar style={isDark ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            {/* Entering/leaving the pay flow rises softly, matching its internal transitions. */}
            <Stack.Screen
              name="pay"
              options={{ animation: "fade_from_bottom", animationDuration: 340 }}
            />
          </Stack>
          <CallOverlay />
        </KeyboardProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
