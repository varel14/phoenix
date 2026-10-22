import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { usersApi } from "@/services/api/users-api";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  AppText,
  Button,
  EmptyView,
  ErrorView,
  IconButton,
  LoadingView,
} from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

/**
 * Notifications: for now this is the follow-request inbox — pending requests
 * arrive here and are accepted or rejected inline. Accepting unlocks mutual
 * chat with the requester.
 */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ["follow-requests"],
    queryFn: () => usersApi.followRequests(),
  });

  async function respond(followerId: string, accept: boolean) {
    if (accept) await usersApi.acceptFollowRequest(followerId);
    else await usersApi.rejectFollowRequest(followerId);
    await queryClient.invalidateQueries({ queryKey: ["follow-requests"] });
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }

  const requests = requestsQuery.data ?? [];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <IconButton
            icon="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Retour"
          />
          <AppText variant="title">Notifications</AppText>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 120,
          gap: spacing.sm,
        }}
      >
        <AppText variant="subheading" style={{ marginTop: spacing.xs }}>
          Demandes de suivi
        </AppText>
        {requestsQuery.isLoading ? (
          <LoadingView label="Chargement…" />
        ) : requestsQuery.isError ? (
          <ErrorView
            message={(requestsQuery.error as Error)?.message}
            onRetry={() => void requestsQuery.refetch()}
          />
        ) : requests.length === 0 ? (
          <EmptyView
            title="Aucune demande"
            subtitle="Les demandes de suivi arrivent ici — acceptez pour discuter ensemble."
          />
        ) : (
          requests.map((request) => (
            <View
              key={request.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: radii.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <UserAvatar user={request} size={46} />
              <View style={{ flex: 1 }}>
                <AppText variant="subheading" numberOfLines={1}>
                  {request.name}
                </AppText>
                <AppText variant="caption" color={colors.textFaint}>
                  souhaite vous suivre
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Refuser la demande de ${request.name}`}
                onPress={() => void respond(request.id, false)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.sm,
                  height: 32,
                  borderRadius: radii.sm + 2,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <AppText
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.textMuted,
                  }}
                >
                  Refuser
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Accepter la demande de ${request.name}`}
                onPress={() => void respond(request.id, true)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.sm,
                  height: 32,
                  borderRadius: radii.sm + 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed
                    ? colors.primaryDeep
                    : colors.primary,
                })}
              >
                <AppText
                  style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}
                >
                  Accepter
                </AppText>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
