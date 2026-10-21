import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AppText, EmptyView, IconButton } from "@/components/ui";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

/**
 * Placeholder notifications screen — the backend has no notifications-list
 * endpoint yet (only push-to-chat), so this renders the empty state until
 * a real feed exists.
 */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" />
          <AppText variant="title">Notifications</AppText>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <EmptyView title="Aucune notification" subtitle="Vous serez informé des nouveautés et messages ici." />
      </ScrollView>
    </View>
  );
}
