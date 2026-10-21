import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationsApi } from "@/services/api/chat-api";
import { useConversations, useCallHistory } from "@/hooks/use-scl";
import { useAuthStore } from "@/stores/auth-store";
import { UserAvatar } from "@/components/chat/user-avatar";
import { AppText, EmptyView, ErrorView, IconButton, Input, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import type { Call, ConversationSummary } from "@/types/chat";

type Segment = "discussions" | "appels";

export default function MessagesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [segment, setSegment] = useState<Segment>("discussions");
  const [search, setSearch] = useState("");
  const [pickerVisible, setPickerVisible] = useState(false);

  const conversationsQuery = useConversations(search.trim() ? { search: search.trim() } : {});
  const callsQuery = useCallHistory();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="title">Messages</AppText>
          <IconButton
            icon="add-circle-outline"
            size={26}
            color={colors.accent}
            accessibilityLabel="Nouvelle conversation"
            onPress={() => setPickerVisible(true)}
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
              backgroundColor: segment === value ? colors.primary : "transparent",
            }}
          >
            <AppText style={{ color: segment === value ? colors.onPrimary : colors.textMuted, fontWeight: "700", fontSize: 13 }}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {segment === "discussions" ? (
        <ConversationsList query={conversationsQuery} currentUserId={user?.id ?? ""} />
      ) : (
        <CallsList query={callsQuery} currentUserId={user?.id ?? ""} />
      )}

      <NewConversationPicker visible={pickerVisible} onClose={() => setPickerVisible(false)} />
    </View>
  );
}

function ConversationsList({
  query,
  currentUserId,
}: {
  query: ReturnType<typeof useConversations>;
  currentUserId: string;
}) {
  const { colors } = useTheme();

  if (query.isLoading) return <LoadingView label="Chargement des conversations…" />;
  if (query.isError) return <ErrorView message={(query.error as Error)?.message} onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.data.length === 0) {
    return (
      <EmptyView
        title="Aucune conversation"
        subtitle="Commencez une conversation pour échanger avec d'autres utilisateurs."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: 120 }}>
      {query.data.data.map((conversation) => {
        const other = conversation.participants.find((p) => p.userId !== currentUserId);
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
              backgroundColor: pressed ? colors.surfaceHighlight : "transparent",
            })}
          >
            <UserAvatar user={display} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText variant="subheading" numberOfLines={1}>
                  {display.name}
                </AppText>
                <AppText variant="small" color={colors.textFaint}>
                  {formatConversationTime(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
                </AppText>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                {conversation.lastMessage?.type === "VOICE" ? (
                  <Ionicons name="mic" size={14} color={colors.textFaint} />
                ) : null}
                <AppText
                  variant="bodyMuted"
                  numberOfLines={1}
                  style={{ flex: 1, color: conversation.unreadCount > 0 ? colors.text : colors.textMuted }}
                >
                  {previewFor(conversation.lastMessage)}
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
                    <AppText style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
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

function CallsList({ query, currentUserId }: { query: ReturnType<typeof useCallHistory>; currentUserId: string }) {
  const { colors } = useTheme();

  if (query.isLoading) return <LoadingView label="Chargement des appels…" />;
  if (query.isError) return <ErrorView message={(query.error as Error)?.message} onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.data.length === 0) {
    return <EmptyView title="Aucun appel" subtitle="Vos appels passés et reçus apparaîtront ici." />;
  }

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: 120 }}>
      {query.data.data.map((call) => (
        <CallRow key={call.id} call={call} currentUserId={currentUserId} />
      ))}
    </ScrollView>
  );
}

function CallRow({ call, currentUserId }: { call: Call; currentUserId: string }) {
  const { colors } = useTheme();
  const outgoing = call.callerId === currentUserId;
  const other = outgoing ? call.recipient : call.caller;

  const missed = call.status === "MISSED" || call.status === "REJECTED";
  const icon = call.type === "VIDEO" ? "videocam" : "call";
  const directionIcon = outgoing ? "arrow-up-outline" : "arrow-down-outline";
  const directionColor = missed ? colors.danger : colors.success;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
      <UserAvatar user={other} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {other.name}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name={directionIcon} size={13} color={directionColor} />
          <Ionicons name={icon} size={14} color={colors.textFaint} />
          <AppText variant="small" color={missed ? colors.danger : colors.textFaint}>
            {callStatusLabel(call, outgoing)}
          </AppText>
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <AppText variant="small" color={colors.textFaint}>
          {formatConversationTime(call.createdAt)}
        </AppText>
        {call.durationSec ? <AppText variant="small" color={colors.textFaint}>{formatDuration(call.durationSec)}</AppText> : null}
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

function previewFor(message: ConversationSummary["lastMessage"]): string {
  if (!message) return "Nouvelle conversation";
  if (message.type === "VOICE") return "Message vocal";
  return message.content ?? "";
}

function formatConversationTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function NewConversationPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const trimmed = search.trim();

  const usersQuery = useQuery({
    queryKey: ["conversation-users", trimmed],
    queryFn: () => conversationsApi.searchUsers(trimmed),
    enabled: visible && trimmed.length >= 2,
  });

  const createConversation = useMutation({
    mutationFn: (recipientId: string) => conversationsApi.create(recipientId),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
      setSearch("");
      router.push(`/chat/${conversation.id}`);
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Math.max(insets.top, spacing.lg) }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg }}>
          <IconButton icon="close" onPress={onClose} accessibilityLabel="Fermer" />
          <AppText variant="heading" style={{ marginLeft: spacing.sm }}>
            Nouvelle conversation
          </AppText>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Input placeholder="Nom de l'utilisateur" value={search} onChangeText={setSearch} autoFocus />
        </View>
        <ScrollView contentContainerStyle={{ paddingVertical: spacing.md }}>
          {trimmed.length < 2 ? (
            <EmptyView title="Rechercher un contact" subtitle="Saisissez au moins 2 lettres du nom de l'utilisateur." />
          ) : usersQuery.isLoading ? (
            <LoadingView />
          ) : usersQuery.data && usersQuery.data.length > 0 ? (
            usersQuery.data.map((user) => (
              <Pressable
                key={user.id}
                onPress={() => createConversation.mutate(user.id)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  backgroundColor: pressed ? colors.surfaceHighlight : "transparent",
                })}
              >
                <UserAvatar user={user} size={44} />
                <AppText variant="subheading">{user.name}</AppText>
              </Pressable>
            ))
          ) : (
            <EmptyView title="Aucun utilisateur trouvé" subtitle="Essayez un autre nom." />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
