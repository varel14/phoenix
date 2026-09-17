import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkState } from "expo-network";
import { useAuthStore } from "@/stores/auth-store";
import { radii } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { MiniPlayer } from "@/components/music/mini-player";
import { OfflineBanner } from "@/components/ui";

export default function TabsLayout() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const networkState = useNetworkState();
  const isConnected = networkState?.isConnected ?? true;
  const { colors } = useTheme();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <OfflineBanner visible={!isConnected} />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: "Artistes",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "search" : "search-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Bibliothèque",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "library" : "library-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
            ),
          }}
        />
      </Tabs>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 60 + insets.bottom, borderRadius: radii.md }}>
        <MiniPlayer />
      </View>
    </View>
  );
}
