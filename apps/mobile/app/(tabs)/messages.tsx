import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationsApi } from "@/services/api/chat-api";
import { useConversations, useCallHistory } from "@/hooks/use-scl";
import { useAuthStore } from "@/stores/auth-store";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  AppText,
  EmptyView,
  ErrorView,
  IconButton,
  Input,
  LoadingView,
} from "@/components/ui";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatChatTimestamp, formatDuration } from "@/utils/format";
import { loadCachedSummaries, saveSummaries } from "@/services/chat/chat-cache";
import type { Call, ConversationSummary } from "@/types/chat";

type Segment = "discussions" | "appels";

export default function MessagesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [segment, setSegment] = useState<Segment>("discussions");
  const [search, setSearch] = useState("");

  const conversationsQuery = useConversations(
    search.trim() ? { search: search.trim() } : {},
  );
  const callsQuery = useCallHistory();
  const cachedSummaries = useMemo(() => loadCachedSummaries(), []);
  // Only the unfiltered list is cached — search results are ephemeral.
  useEffect(() => {
    if (conversationsQuery.data && !search.trim()) {
      saveSummaries(conversationsQuery.data.data);
    }
  }, [conversationsQuery.data, search]);
  /** Fresh data when online; the MMKV snapshot when loading or offline. */
  const summaries =
    conversationsQuery.data?.data ??
    (conversationsQuery.isLoading ? [] : cachedSummaries);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <AppText variant="title">Messages</AppText>
          <IconButton
            icon="add-circle-outline"
            size={26}
            color={colors.accent}
            accessibilityLabel="Nouvelle conversation"
            onPress={() => router.push("/chat/new")}
          />
        </View>
        <Input
          placeholder="Rechercher une conversation"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          style={{ marginTop: spacing.md }}
        />
      </View>

      {/* Segmented control */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: spacing.lg,
          marginTop: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radii.md,
          padding: 4,
        }}
      >
        {(
          [
            ["discussions", "Discussions"],
            ["appels", "Appels"],
          ] as Array<[Segment, string]>
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setSegment(value)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: radii.sm + 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                segment === value ? colors.primary : "transparent",
            }}
          >
            <AppText
              style={{
                color: segment === value ? colors.onPrimary : colors.textMuted,
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {segment === "discussions" ? (
        <ConversationsList
          summaries={summaries}
          isLoading={conversationsQuery.isLoading && summaries.length === 0}
          error={
            conversationsQuery.isError
              ? (conversationsQuery.error as Error)
              : null
          }
          onRetry={() => void conversationsQuery.refetch()}
          currentUserId={user?.id ?? ""}
        />
      ) : (
        <CallsList query={callsQuery} currentUserId={user?.id ?? ""} />
      )}
    </View>
  );
}

function ConversationsList({
  summaries,
  isLoading,
  error,
  onRetry,
  currentUserId,
}: {
  summaries: ConversationSummary[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  currentUserId: string;
}) {
  const { colors } = useTheme();

  if (isLoading) return <LoadingView label="Chargement des conversations…" />;
  if (error && summaries.length === 0)
    return <ErrorView message={error.message} onRetry={onRetry} />;
  if (summaries.length === 0) {
    return (
      <EmptyView
        title="Aucune conversation"
        subtitle="Commencez une conversation pour échanger avec d'autres utilisateurs."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingVertical: spacing.md,
        paddingBottom: 120,
      }}
    >
      {summaries.map((conversation) => {
        const other = conversation.participants.find(
          (p) => p.userId !== currentUserId,
        );
        const display = other?.user ?? conversation.participants[0]?.user;
        if (!display) return null;
        return (
          <Pressable
            key={conversation.id}
            onPress={() => router.push(`/chat/${conversation.id}`)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              backgroundColor: pressed
                ? colors.surfaceHighlight
                : "transparent",
            })}
          >
            <UserAvatar user={display} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <AppText variant="subheading" numberOfLines={1}>
                  {display.name}
                </AppText>
                <AppText style={{ fontSize: 11, color: colors.textFaint }}>
                  {formatChatTimestamp(
                    conversation.lastMessage?.createdAt ??
                      conversation.updatedAt,
                  )}
                </AppText>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <MessageTicks
                  conversation={conversation}
                  currentUserId={currentUserId}
                />
                {conversation.lastMessage?.type === "VOICE" ? (
                  <Ionicons name="mic" size={12} color={colors.textFaint} />
                ) : null}
                <AppText
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color:
                      conversation.unreadCount > 0
                        ? colors.text
                        : colors.textMuted,
                  }}
                >
                  {previewFor(conversation.lastMessage, conversation.isDraft)}
                </AppText>
                {conversation.unreadCount > 0 ? (
                  <View
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: radii.full,
                      backgroundColor: colors.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 6,
                    }}
                  >
                    <AppText
                      style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}
                    >
                      {conversation.unreadCount > 9
                        ? "9+"
                        : conversation.unreadCount}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CallsList({
  query,
  currentUserId,
}: {
  query: ReturnType<typeof useCallHistory>;
  currentUserId: string;
}) {
  const { colors } = useTheme();

  if (query.isLoading) return <LoadingView label="Chargement des appels…" />;
  if (query.isError)
    return (
      <ErrorView
        message={(query.error as Error)?.message}
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data || query.data.data.length === 0) {
    return (
      <EmptyView
        title="Aucun appel"
        subtitle="Vos appels passés et reçus apparaîtront ici."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingVertical: spacing.md,
        paddingBottom: 120,
      }}
    >
      {query.data.data.map((call) => (
        <CallRow key={call.id} call={call} currentUserId={currentUserId} />
      ))}
    </ScrollView>
  );
}

function CallRow({
  call,
  currentUserId,
}: {
  call: Call;
  currentUserId: string;
}) {
  const { colors } = useTheme();
  const outgoing = call.callerId === currentUserId;
  const other = outgoing ? call.recipient : call.caller;

  const missed = call.status === "MISSED" || call.status === "REJECTED";
  const icon = call.type === "VIDEO" ? "videocam" : "call";
  const directionIcon = outgoing ? "arrow-up-outline" : "arrow-down-outline";
  const directionColor = missed ? colors.danger : colors.success;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}
    >
      <UserAvatar user={other} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {other.name}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name={directionIcon} size={13} color={directionColor} />
          <Ionicons name={icon} size={14} color={colors.textFaint} />
          <AppText
            variant="small"
            color={missed ? colors.danger : colors.textFaint}
          >
            {callStatusLabel(call, outgoing)}
          </AppText>
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <AppText variant="small" color={colors.textFaint}>
          {formatChatTimestamp(call.createdAt)}
        </AppText>
        {call.durationSec ? (
          <AppText variant="small" color={colors.textFaint}>
            {formatDuration(call.durationSec)}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function callStatusLabel(call: Call, outgoing: boolean): string {
  switch (call.status) {
    case "MISSED":
      return outgoing ? "Sans réponse" : "Appel manqué";
    case "REJECTED":
      return "Refusé";
    case "RINGING":
      return "En cours…";
    case "ACCEPTED":
      return "Répondu";
    case "ENDED":
      return outgoing ? "Sortant" : "Entrant";
    case "FAILED":
      return "Échoué";
    default:
      return call.status;
  }
}

function previewFor(
  message: ConversationSummary["lastMessage"],
  isDraft?: boolean,
): string {
  if (!message)
    return isDraft ? "Aucun message — brouillon" : "Nouvelle conversation";
  if (message.type === "VOICE") return "Message vocal";
  return message.content ?? "";
}

/**
 * WhatsApp-style delivery state for the row's own last message: single check
 * once stored on the server, double check once the other side has read it.
 */
function MessageTicks({
  conversation,
  currentUserId,
}: {
  conversation: ConversationSummary;
  currentUserId: string;
}) {
  const { colors } = useTheme();
  const lastMessage = conversation.lastMessage;
  if (!lastMessage || lastMessage.senderId !== currentUserId) return null;
  const other = conversation.participants.find(
    (p) => p.userId !== currentUserId,
  );
  const read =
    !!other?.lastReadAt &&
    new Date(other.lastReadAt) >= new Date(lastMessage.createdAt);
  return (
    <Ionicons
      name={read ? "checkmark-done" : "checkmark"}
      size={13}
      color={read ? colors.primary : colors.textFaint}
    />
  );
}
