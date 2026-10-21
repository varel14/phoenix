import { useEffect, useRef } from "react";
import { Redirect, Tabs } from "expo-router";
import {
  Animated,
  Pressable,
  Text as RNText,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkState } from "expo-network";
import { useAuthStore } from "@/stores/auth-store";
import { spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { MiniPlayer } from "@/components/music/mini-player";
import { OfflineBanner } from "@/components/ui";

/** Content height of the floating bar (icon + label zone). */
const TAB_BAR_HEIGHT = 64;
/** Gap between the bar and the home-indicator inset. */
const BAR_FLOAT = 10;
/** Gap between the mini player and the top of the tab bar. */
const PLAYER_GAP = 10;

/**
 * Reference-style tab button: a stable grid cell that always shows icon +
 * label. The active tab tints violet and gently springs up; nothing changes
 * size or position between tabs, so switching tabs never reshuffles the bar.
 */
function TabBarButton({
  accessibilityState,
  style,
  children,
  ...rest
}: {
  accessibilityState?: { selected?: boolean };
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  const focused = !!accessibilityState?.selected;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.06 : 1,
      speed: 34,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <Pressable
      accessibilityState={accessibilityState}
      style={[
        style,
        {
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
        },
      ]}
      {...rest}
    >
      <Animated.View
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale }],
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Per-tab label: always rendered, weight/color driven by the active tint. */
function tabLabel(title: string) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <RNText
      style={{
        fontSize: 10.5,
        fontWeight: focused ? "700" : "600",
        letterSpacing: 0.1,
        color,
      }}
      numberOfLines={1}
    >
      {title}
    </RNText>
  );
}

export default function TabsLayout() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const networkState = useNetworkState();
  const isConnected = networkState?.isConnected ?? true;
  const { colors, shadows } = useTheme();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <OfflineBanner visible={!isConnected} />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarButton: (props) => <TabBarButton {...props} />,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: {
            position: "absolute",
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + BAR_FLOAT,
            height: TAB_BAR_HEIGHT,
            backgroundColor: withAlpha(colors.surface, 0.97),
            borderRadius: TAB_BAR_HEIGHT / 2,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: colors.hairline,
            boxShadow: shadows.float,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarLabel: tabLabel("Accueil"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarLabel: tabLabel("Messages"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "chatbubbles" : "chatbubbles-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="boutique"
          options={{
            title: "Boutique",
            tabBarLabel: tabLabel("Boutique"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "bag" : "bag-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: "Artistes",
            tabBarLabel: tabLabel("Artistes"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "search" : "search-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Bibliothèque",
            tabBarLabel: tabLabel("Biblio"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "library" : "library-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            tabBarLabel: tabLabel("Profil"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
      {/* Mini player floats in a dedicated slot above the tab bar — never overlapping it. */}
      <View
        style={{
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          bottom: insets.bottom + BAR_FLOAT + TAB_BAR_HEIGHT + PLAYER_GAP,
        }}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}
