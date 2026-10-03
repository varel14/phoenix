import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteMessages, useConversation, useMarkRead, useSendMessage } from "@/hooks/use-scl";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { getSocket } from "@/services/realtime/socket";
import { uploadFile } from "@/services/api/uploads-api";
import { useAuthStore } from "@/stores/auth-store";
import { useCallStore } from "@/stores/call-store";
import { webrtcService } from "@/services/calls/webrtc.service";
import { UserAvatar } from "@/components/chat/user-avatar";
import { VoicePlayer } from "@/components/chat/voice-player";
import { AppText, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import type { Message } from "@/types/chat";

/** Client-only optimistic message (replaced by the server record). */
interface OptimisticMessage {
  id: string;
  serverId?: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "VOICE";
  content: string | null;
  createdAt: string;
  sender: { id: string; name: string; image: string | null };
  attachment?: Message["attachment"];
  pending?: boolean;
  failed?: boolean;
}

type ChatMessage = Message | OptimisticMessage;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  const conversationQuery = useConversation(id);
  const messagesQuery = useInfiniteMessages(id);
  const markRead = useMarkRead();
  const sendMessage = useSendMessage();
  const recorder = useVoiceRecorder();

  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const callPhase = useCallStore((state) => state.phase);

  const conversation = conversationQuery.data;
  const other = useMemo(
    () => conversation?.participants.find((p) => p.userId !== user?.id)?.user ?? null,
    [conversation, user?.id],
  );
  const otherId = other?.id ?? "";
  const currentUserId = user?.id ?? "";

  const messages: ChatMessage[] = useMemo(() => {
    const server = messagesQuery.data?.pages.flatMap((page) => page.messages) ?? [];
    const optimisticNotSynced = optimistic.filter(
      (message) => !server.some((serverMessage) => serverMessage.id === message.serverId),
    );
    return [...server, ...optimisticNotSynced];
  }, [messagesQuery.data, optimistic]);

  const markConversationRead = useCallback(() => {
    void markRead.mutateAsync(id).catch(() => undefined);
  }, [id, markRead]);

  // Realtime: join the conversation room; refresh list when a message lands.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("conversation:join", { conversationId: id });
    const onNewMessage = () => {
      markConversationRead();
    };
    socket.on("message:new", onNewMessage);
    return () => {
      socket.off("message:new", onNewMessage);
      socket.emit("conversation:leave", { conversationId: id });
    };
  }, [id, markConversationRead]);

  useEffect(() => {
    if (messages.length > 0) markConversationRead();
  }, [messages.length, markConversationRead]);

  // Keep the list pinned to the newest message.
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: false });
  }, [messages.length]);

  function sendText() {
    const content = draft.trim();
    if (!content || sendMessage.isPending) return;
    setDraft("");
    setError(null);
    const optimisticMessage: OptimisticMessage = {
      id: `local-${Date.now()}`,
      conversationId: id,
      senderId: currentUserId,
      type: "TEXT",
      content,
      createdAt: new Date().toISOString(),
      sender: { id: currentUserId, name: user?.name ?? "", image: user?.image ?? null },
      pending: true,
    };
    setOptimistic((previous) => [...previous, optimisticMessage]);
    sendMessage.mutate(
      { conversationId: id, body: { type: "TEXT", content } },
      {
        onSuccess: (message) => {
          setOptimistic((previous) =>
            previous.map((entry) => (entry.id === optimisticMessage.id ? { ...entry, serverId: message.id, pending: false } : entry)),
          );
        },
        onError: (mutationError) => {
          setOptimistic((previous) =>
            previous.map((entry) => (entry.id === optimisticMessage.id ? { ...entry, pending: false, failed: true } : entry)),
          );
          setError((mutationError as Error).message);
        },
      },
    );
  }

  async function sendVoice() {
    setError(null);
    const result = await recorder.stop();
    if (!result) return;
    if (result.durationSec < 1) return;
    setSendingVoice(true);
    try {
      const upload = await uploadFile(result.uri, "voice", result.mimeType);
      await sendMessage.mutateAsync({
        conversationId: id,
        body: {
          type: "VOICE",
          attachment: {
            url: upload.url ?? "",
            storageKey: upload.storageKey,
            mimeType: upload.mimeType,
            fileSizeBytes: upload.fileSizeBytes,
            durationSec: result.durationSec,
            name: "message-vocal.m4a",
          },
        },
      });
    } catch (sendError) {
      setError((sendError as Error).message);
    } finally {
      setSendingVoice(false);
    }
  }

  if (conversationQuery.isLoading) {
    return <LoadingView label="Chargement de la conversation…" />;
  }
  if (conversationQuery.isError || !conversation) {
    return <ErrorView message={(conversationQuery.error as Error)?.message} onRetry={() => void conversationQuery.refetch()} />;
  }

  const canCall = Boolean(otherId) && callPhase === "idle";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" />
        {other ? <UserAvatar user={other} size={38} /> : null}
        <View style={{ flex: 1 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {other?.name ?? "Conversation"}
          </AppText>
        </View>
        <IconButton
          icon="call-outline"
          disabled={!canCall}
          onPress={() => void webrtcService.startCall(otherId, "AUDIO", id)}
          accessibilityLabel="Appel audio"
        />
        <IconButton
          icon="videocam-outline"
          disabled={!canCall}
          onPress={() => void webrtcService.startCall(otherId, "VIDEO", id)}
          accessibilityLabel="Appel vidéo"
        />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl }}
        onScrollBeginDrag={() => {
          if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
            void messagesQuery.fetchNextPage();
          }
        }}
      >
        {messages.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="chatbubble-ellipses-outline" size={44} color={colors.textFaint} />
            <AppText variant="bodyMuted" align="center">
              Aucun message. Envoyez le premier message à {other?.name ?? "votre contact"}.
            </AppText>
          </View>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} currentUserId={currentUserId} />
          ))
        )}
      </ScrollView>

      {/* Error line */}
      {error ? (
        <AppText style={{ color: colors.danger, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, fontSize: 12 }}>
          {error}
        </AppText>
      ) : null}
      {recorder.permissionDenied ? (
        <AppText style={{ color: colors.danger, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, fontSize: 12 }}>
          L'accès au micro est nécessaire pour envoyer des messages vocaux. Autorisez-le dans les réglages.
        </AppText>
      ) : null}

      {/* Composer */}
      {recorder.recording ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
          }}
        >
          <IconButton icon="close-circle" color={colors.danger} onPress={() => void recorder.cancel()} accessibilityLabel="Annuler" />
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radii.full,
              paddingHorizontal: spacing.lg,
              height: 48,
            }}
          >
            <Ionicons name="mic" size={18} color={colors.danger} />
            <View style={{ flexDirection: "row", gap: 3, alignItems: "flex-end" }}>
              {[0, 1, 2, 3, 4].map((index) => (
                <View
                  key={index}
                  style={{
                    width: 3,
                    height: 8 + ((recorder.elapsedSec + index) % 3) * 6,
                    borderRadius: 2,
                    backgroundColor: colors.accent,
                  }}
                />
              ))}
            </View>
            <AppText variant="bodyMuted">{formatDuration(recorder.elapsedSec)}</AppText>
          </View>
          <IconButton
            icon="send"
            color={colors.accent}
            disabled={sendingVoice}
            onPress={() => void sendVoice()}
            accessibilityLabel="Envoyer"
          />
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
            paddingBottom: insets.bottom + spacing.sm,
          }}
        >
          <IconButton
            icon="mic-outline"
            size={26}
            color={sendingVoice ? colors.textFaint : colors.accent}
            disabled={sendingVoice}
            onPress={() => void recorder.start()}
            accessibilityLabel="Enregistrer un message vocal"
          />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Écrire un message…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.full,
              color: colors.text,
              paddingHorizontal: spacing.lg,
              paddingTop: 12,
              paddingBottom: 12,
              maxHeight: 110,
              fontSize: 15,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            onPress={sendText}
            disabled={!draft.trim() || sendMessage.isPending}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radii.full,
              backgroundColor: draft.trim() ? colors.accent : colors.surfaceHighlight,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="send" size={20} color={draft.trim() ? "#fff" : colors.textFaint} />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, currentUserId }: { message: ChatMessage; currentUserId: string }) {
  const { colors } = useTheme();
  const mine = message.senderId === currentUserId;

  return (
    <View style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <View
        style={{
          maxWidth: "80%",
          backgroundColor: mine ? colors.primary : colors.surface,
          borderRadius: radii.lg,
          borderBottomRightRadius: mine ? radii.sm : radii.lg,
          borderBottomLeftRadius: mine ? radii.lg : radii.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: 4,
          opacity: "pending" in message && message.pending ? 0.6 : 1,
        }}
      >
        {message.type === "VOICE" && message.attachment ? (
          <VoicePlayer attachment={message.attachment} incoming={!mine} />
        ) : (
          <AppText style={{ color: mine ? colors.onPrimary : colors.text, fontSize: 15 }}>{message.content}</AppText>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
          <AppText style={{ fontSize: 10, color: mine ? "rgba(255,255,255,0.7)" : colors.textFaint }}>
            {new Date(message.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </AppText>
          {mine ? (
            <Ionicons
              name={"failed" in message && message.failed ? "warning" : "checkmark"}
              size={12}
              color={"failed" in message && message.failed ? colors.warning : "rgba(255,255,255,0.7)"}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
