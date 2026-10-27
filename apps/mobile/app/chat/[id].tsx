import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  useInfiniteMessages,
  useConversation,
  useMarkRead,
  useSendMessage,
} from "@/hooks/use-scl";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { getSocket } from "@/services/realtime/socket";
import { loadCachedMessages, saveMessages } from "@/services/chat/chat-cache";
import { conversationsApi } from "@/services/api/chat-api";
import { uploadFile } from "@/services/api/uploads-api";
import { seedVoiceNote } from "@/services/media/voice-cache";
import { seedSentMedia } from "@/services/media/sent-media-cache";
import {
  capturePhoto,
  pickChatDocument,
  pickChatVideo,
  pickImageFile,
} from "@/services/media/media-picker";
import { useAuthStore } from "@/stores/auth-store";
import { useCallStore } from "@/stores/call-store";
import { webrtcService } from "@/services/calls/webrtc.service";
import { AttachPanel } from "@/components/chat/attach-panel";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { MediaAttachmentBody } from "@/components/chat/message-attachment";
import { UserAvatar } from "@/components/chat/user-avatar";
import { VoicePlayer } from "@/components/chat/voice-player";
import { VoicePreview } from "@/components/chat/voice-preview";
import {
  Input,
  AppText,
  ErrorView,
  IconButton,
  LoadingView,
  PressableScale,
} from "@/components/ui";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import type { Message } from "@/types/chat";

/** Client-only optimistic message (replaced by the server record). */
interface OptimisticMessage {
  id: string;
  serverId?: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "VOICE" | "IMAGE" | "VIDEO" | "FILE";
  content: string | null;
  createdAt: string;
  sender: { id: string; name: string; image: string | null };
  attachment?: Message["attachment"];
  pending?: boolean;
  failed?: boolean;
}

type ChatMessage = Message | OptimisticMessage;

const BUBBLE_RADIUS = 20;
const GROUP_GAP_SEC = 5 * 60;

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(
    "fr-FR",
    sameYear
      ? { day: "numeric", month: "long" }
      : { day: "numeric", month: "long", year: "numeric" },
  );
}

function withinGap(previousIso: string, iso: string): boolean {
  return (
    new Date(iso).getTime() - new Date(previousIso).getTime() <
    GROUP_GAP_SEC * 1000
  );
}

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
  /** Locally persisted thread — rendered instantly while the network loads. */
  const [cachedMessages] = useState(() => loadCachedMessages(id));
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingVoice, setSendingVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** WhatsApp-style pre-send clip; non-null switches the composer to preview mode. */
  const [recorded, setRecorded] = useState<{
    uri: string;
    durationSec: number;
    mimeType: string;
  } | null>(null);
  const [panel, setPanel] = useState<"none" | "emoji" | "attach">("none");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const callPhase = useCallStore((state) => state.phase);

  const conversation = conversationQuery.data;
  const other = useMemo(
    () =>
      conversation?.participants.find((p) => p.userId !== user?.id)?.user ??
      null,
    [conversation, user?.id],
  );
  const otherParticipant = conversation?.participants.find(
    (p) => p.userId !== user?.id,
  );
  const otherId = other?.id ?? "";
  const currentUserId = user?.id ?? "";

  const serverMessages = useMemo(
    () =>
      [
        ...(messagesQuery.data?.pages.flatMap((page) => page.messages) ?? []),
      ].reverse(),
    [messagesQuery.data],
  );

  const messages: ChatMessage[] = useMemo(() => {
    // Cached rows render instantly; the server copy overrides them by id, so
    // the freshest data always wins without flicker.
    const byId = new Map<string, ChatMessage>();
    for (const message of cachedMessages) byId.set(message.id, message);
    for (const message of serverMessages) byId.set(message.id, message);
    const optimisticNotSynced = optimistic.filter(
      (message) => !byId.has(message.serverId ?? "") && !byId.has(message.id),
    );
    for (const message of optimisticNotSynced) byId.set(message.id, message);
    return [...byId.values()].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [cachedMessages, serverMessages, optimistic]);

  // Persist on every confirmed send/reception (server pages only — pending
  // optimistic rows stay local until the server acknowledges them).
  useEffect(() => {
    if (serverMessages.length > 0) saveMessages(id, serverMessages);
  }, [id, serverMessages]);

  // Typo-tolerant in-chat search (pg_trgm on the server), live as you type.
  const trimmedSearch = searchQuery.trim();
  const messageSearch = useQuery({
    queryKey: ["chat-search", id, trimmedSearch],
    queryFn: () => conversationsApi.searchMessages(id, trimmedSearch),
    enabled: searching && trimmedSearch.length >= 2,
  });

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
      sender: {
        id: currentUserId,
        name: user?.name ?? "",
        image: user?.image ?? null,
      },
      pending: true,
    };
    setOptimistic((previous) => [...previous, optimisticMessage]);
    sendMessage.mutate(
      { conversationId: id, body: { type: "TEXT", content } },
      {
        onSuccess: (message) => {
          setOptimistic((previous) =>
            previous.map((entry) =>
              entry.id === optimisticMessage.id
                ? { ...entry, serverId: message.id, pending: false }
                : entry,
            ),
          );
        },
        onError: (mutationError) => {
          setOptimistic((previous) =>
            previous.map((entry) =>
              entry.id === optimisticMessage.id
                ? { ...entry, pending: false, failed: true }
                : entry,
            ),
          );
          setError((mutationError as Error).message);
        },
      },
    );
  }

  /** Stop recording but keep the clip for the listen-before-send step. */
  async function stopForPreview() {
    const result = await recorder.stop();
    if (!result) return;
    setRecorded(result);
  }

  function discardRecording() {
    void recorder.cancel();
    setRecorded(null);
  }

  async function sendRecorded() {
    if (!recorded || sendMessage.isPending || sendingVoice) return;
    if (recorded.durationSec < 1) {
      setRecorded(null);
      return;
    }
    setError(null);
    setSendingVoice(true);
    try {
      const upload = await uploadFile(recorded.uri, "voice", recorded.mimeType);
      // The clip is already on disk — register it in the voice cache before
      // the message can render, so the sent bubble plays without a download.
      await seedVoiceNote({
        storageKey: upload.storageKey,
        sourceUrl: upload.url ?? "",
        localUri: recorded.uri,
      });
      await sendMessage.mutateAsync({
        conversationId: id,
        body: {
          type: "VOICE",
          attachment: {
            url: upload.url ?? "",
            storageKey: upload.storageKey,
            mimeType: upload.mimeType,
            fileSizeBytes: upload.fileSizeBytes,
            durationSec: recorded.durationSec,
            name: "message-vocal.m4a",
          },
        },
      });
      setRecorded(null);
    } catch (sendError) {
      setError((sendError as Error).message);
    } finally {
      setSendingVoice(false);
    }
  }

  /** Pick → optimistic bubble with the local file → upload → send with real metadata. */
  async function handleAttach(choice: "photo" | "camera" | "video" | "file") {
    if (uploadingAttachment) return;
    setPanel("none");
    const media =
      choice === "photo"
        ? await pickImageFile()
        : choice === "camera"
          ? await capturePhoto()
          : choice === "video"
            ? await pickChatVideo()
            : await pickChatDocument();
    if (!media) return;
    const spec =
      choice === "video"
        ? { type: "VIDEO" as const, kind: "video" as const }
        : choice === "file"
          ? { type: "FILE" as const, kind: "file" as const }
          : { type: "IMAGE" as const, kind: "image" as const };
    setError(null);
    const optimisticMessage: OptimisticMessage = {
      id: `local-${Date.now()}`,
      conversationId: id,
      senderId: currentUserId,
      type: spec.type,
      content: null,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUserId,
        name: user?.name ?? "",
        image: user?.image ?? null,
      },
      attachment: {
        id: `local-att-${Date.now()}`,
        messageId: "local",
        url: media.uri,
        storageKey: "local",
        mimeType: media.mimeType,
        fileSizeBytes: media.fileSizeBytes,
        durationSec: null,
        name: media.name,
      },
      pending: true,
    };
    setOptimistic((previous) => [...previous, optimisticMessage]);
    setUploadingAttachment(true);
    try {
      const upload = await uploadFile(media.uri, spec.kind, media.mimeType);
      // The picked file is already on disk — register it before the server
      // message can render, so the sent bubble never re-downloads it.
      await seedSentMedia({
        storageKey: upload.storageKey,
        sourceUrl: upload.url ?? "",
        localUri: media.uri,
      });
      const message = await sendMessage.mutateAsync({
        conversationId: id,
        body: {
          type: spec.type,
          attachment: {
            url: upload.url ?? "",
            storageKey: upload.storageKey,
            mimeType: upload.mimeType,
            fileSizeBytes: upload.fileSizeBytes,
            name: media.name,
          },
        },
      });
      setOptimistic((previous) =>
        previous.map((entry) =>
          entry.id === optimisticMessage.id
            ? { ...entry, serverId: message.id, pending: false }
            : entry,
        ),
      );
    } catch (attachmentError) {
      setOptimistic((previous) =>
        previous.map((entry) =>
          entry.id === optimisticMessage.id
            ? { ...entry, pending: false, failed: true }
            : entry,
        ),
      );
      setError((attachmentError as Error).message);
    } finally {
      setUploadingAttachment(false);
    }
  }

  /** Insert an emoji at the caret, then put the caret after it. */
  function insertEmoji(emoji: string) {
    const { start, end } = selectionRef.current;
    setDraft((current) => {
      const caretStart = Math.min(start, current.length);
      const caretEnd = Math.min(end, current.length);
      const next =
        current.slice(0, caretStart) + emoji + current.slice(caretEnd);
      requestAnimationFrame(() => {
        inputRef.current?.setSelection(
          caretStart + emoji.length,
          caretStart + emoji.length,
        );
      });
      return next;
    });
  }

  function togglePanel(target: "emoji" | "attach") {
    if (panel === target) {
      setPanel("none");
      inputRef.current?.focus();
      return;
    }
    Keyboard.dismiss();
    setPanel(target);
  }

  if (conversationQuery.isLoading) {
    return <LoadingView label="Chargement de la conversation…" />;
  }
  if (conversationQuery.isError || !conversation) {
    return (
      <ErrorView
        message={(conversationQuery.error as Error)?.message}
        onRetry={() => void conversationQuery.refetch()}
      />
    );
  }

  const canCall = Boolean(otherId) && callPhase === "idle";

  // Render list: date chips between days, bubbles grouped per sender burst.
  const nodes: ReactNode[] = [];
  let previous: ChatMessage | null = null;
  messages.forEach((message, index) => {
    if (!previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)) {
      nodes.push(<DayChip key={`day-${message.id}`} iso={message.createdAt} />);
      previous = null;
    }
    const next = messages[index + 1];
    const groupedWithNext =
      next !== undefined &&
      next.senderId === message.senderId &&
      withinGap(message.createdAt, next.createdAt);
    nodes.push(
      <MessageBubble
        key={message.id}
        message={message}
        mine={message.senderId === currentUserId}
        tail={!groupedWithNext}
        readReceipt={
          message.senderId === currentUserId &&
          !groupedWithNext &&
          Boolean(otherParticipant?.lastReadAt) &&
          new Date(otherParticipant!.lastReadAt!).getTime() >=
            new Date(message.createdAt).getTime()
        }
        spacingAfter={groupedWithNext ? 2 : 12}
        animateIn={message.id.startsWith("local-")}
      />,
    );
    previous = message;
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      // Edge-to-edge Android doesn't resize the window, so lift the composer ourselves.
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
        }}
      >
        <IconButton
          icon="chevron-back"
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        />
        {other ? <UserAvatar user={other} size={40} /> : null}
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {other?.name ?? "Conversation"}
          </AppText>
        </View>
        <IconButton
          icon={searching ? "close" : "search-outline"}
          tinted
          onPress={() => {
            setSearching((value) => !value);
            setSearchQuery("");
          }}
          accessibilityLabel={
            searching
              ? "Fermer la recherche"
              : "Rechercher dans la conversation"
          }
        />
        {!searching ? (
          <IconButton
            icon="call-outline"
            tinted
            disabled={!canCall}
            onPress={() => void webrtcService.startCall(otherId, "AUDIO", id)}
            accessibilityLabel="Appel audio"
          />
        ) : null}
        <IconButton
          icon="videocam-outline"
          tinted
          disabled={!canCall}
          onPress={() => void webrtcService.startCall(otherId, "VIDEO", id)}
          accessibilityLabel="Appel vidéo"
        />
      </View>

      {/* In-chat search (typo-tolerant, server-side trigram matching) */}
      {searching ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <Input
            placeholder="Rechercher dans la conversation…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {trimmedSearch.length >= 2 ? (
            <View style={{ maxHeight: 220 }}>
              {messageSearch.isFetching ? (
                <AppText
                  variant="caption"
                  color={colors.textFaint}
                  style={{ paddingVertical: spacing.sm }}
                >
                  Recherche…
                </AppText>
              ) : (messageSearch.data?.length ?? 0) === 0 ? (
                <AppText
                  variant="caption"
                  color={colors.textFaint}
                  style={{ paddingVertical: spacing.sm }}
                >
                  Aucun message trouvé (les fautes de frappe sont tolérées).
                </AppText>
              ) : (
                <ScrollView
                  style={{ flexGrow: 0 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {messageSearch.data!.map((message) => (
                    <Pressable
                      key={message.id}
                      onPress={() => setSearching(false)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        gap: spacing.md,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        borderRadius: radii.md,
                        backgroundColor: pressed
                          ? colors.surfaceHighlight
                          : "transparent",
                      })}
                    >
                      <AppText
                        style={{
                          fontSize: 11,
                          color: colors.textFaint,
                          fontVariant: ["tabular-nums"],
                          marginTop: 2,
                        }}
                      >
                        {new Date(message.createdAt).toLocaleTimeString(
                          "fr-FR",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </AppText>
                      <AppText
                        numberOfLines={2}
                        style={{ flex: 1, fontSize: 13, color: colors.text }}
                      >
                        {message.content ?? "—"}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
        onScrollBeginDrag={() => {
          if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
            void messagesQuery.fetchNextPage();
          }
        }}
      >
        {messages.length === 0 ? (
          <View
            style={{
              paddingVertical: spacing.xxl,
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: radii.full,
                backgroundColor: colors.primaryTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="chatbubble-ellipses"
                size={30}
                color={colors.primary}
              />
            </View>
            <View style={{ alignItems: "center", gap: 4 }}>
              <AppText variant="subheading">Aucun message</AppText>
              <AppText
                variant="bodyMuted"
                align="center"
                style={{ paddingHorizontal: spacing.xl }}
              >
                Envoyez le premier message à {other?.name ?? "votre contact"}.
              </AppText>
            </View>
          </View>
        ) : (
          nodes
        )}
      </ScrollView>

      {/* Error line */}
      {error ? (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.xs,
            backgroundColor: withAlpha(colors.danger, 0.12),
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <AppText
            style={{ color: colors.danger, fontSize: 12, lineHeight: 16 }}
          >
            {error}
          </AppText>
        </View>
      ) : null}
      {recorder.permissionDenied ? (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.xs,
            backgroundColor: withAlpha(colors.danger, 0.12),
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <AppText
            style={{ color: colors.danger, fontSize: 12, lineHeight: 16 }}
          >
            L'accès au micro est nécessaire pour envoyer des messages vocaux.
            Autorisez-le dans les réglages.
          </AppText>
        </View>
      ) : null}

      {/* Emoji / attachment panels (idle composer only) */}
      {!recorder.recording && !recorded && panel === "emoji" ? (
        <EmojiPicker onSelect={insertEmoji} />
      ) : null}
      {!recorder.recording && !recorded && panel === "attach" ? (
        <AttachPanel
          onPick={(choice) => void handleAttach(choice)}
          busy={uploadingAttachment}
        />
      ) : null}

      {/* Composer */}
      {recorder.recording ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.hairline,
          }}
        >
          <IconButton
            icon="close-circle"
            color={colors.danger}
            onPress={() => void recorder.cancel()}
            accessibilityLabel="Annuler"
          />
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: colors.surfaceElevated,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairline,
              borderRadius: 24,
              paddingHorizontal: spacing.lg,
              height: 48,
            }}
          >
            <Ionicons name="mic" size={16} color={colors.danger} />
            <RecordingBars color={colors.accent} />
            <AppText
              variant="bodyMuted"
              style={{ marginLeft: "auto", fontVariant: ["tabular-nums"] }}
            >
              {formatDuration(recorder.elapsedSec)}
            </AppText>
          </View>
          {/* Stop → pre-send preview (WhatsApp flow) */}
          <SendButton
            icon="stop"
            active={!sendingVoice}
            disabled={sendingVoice}
            onPress={() => void stopForPreview()}
            accessibilityLabel="Terminer et écouter"
          />
        </View>
      ) : recorded ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.hairline,
          }}
        >
          <IconButton
            icon="trash-outline"
            color={colors.danger}
            onPress={discardRecording}
            accessibilityLabel="Supprimer l'enregistrement"
          />
          <VoicePreview uri={recorded.uri} durationSec={recorded.durationSec} />
          <SendButton
            active={!sendingVoice}
            disabled={sendingVoice}
            onPress={() => void sendRecorded()}
            accessibilityLabel="Envoyer le message vocal"
          />
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
          }}
        >
          <IconButton
            icon="add-circle-outline"
            size={24}
            tinted
            disabled={uploadingAttachment}
            onPress={() => togglePanel("attach")}
            accessibilityLabel="Joindre une photo, une vidéo ou un fichier"
          />
          <IconButton
            icon="happy-outline"
            size={24}
            tinted
            color={panel === "emoji" ? colors.primary : colors.accent}
            onPress={() => togglePanel("emoji")}
            accessibilityLabel="Emojis"
          />
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setPanel("none")}
            onSelectionChange={(event) => {
              selectionRef.current = event.nativeEvent.selection;
            }}
            placeholder="Écrire un message…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={{
              flex: 1,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.hairline,
              borderWidth: 1,
              borderRadius: 22,
              color: colors.text,
              paddingHorizontal: spacing.lg,
              paddingTop: 12,
              paddingBottom: 12,
              maxHeight: 110,
              fontSize: 15,
              lineHeight: 20,
            }}
          />
          {draft.trim() ? (
            <SendButton
              active={!sendMessage.isPending}
              disabled={sendMessage.isPending}
              onPress={sendText}
              accessibilityLabel="Envoyer"
            />
          ) : (
            <IconButton
              icon="mic-outline"
              size={22}
              tinted
              disabled={sendingVoice}
              onPress={() => {
                setPanel("none");
                void recorder.start();
              }}
              accessibilityLabel="Enregistrer un message vocal"
            />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** Gradient send pill; inert disc when there is nothing to send. */
function SendButton({
  active,
  disabled,
  onPress,
  accessibilityLabel,
  icon = "send",
}: {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const { colors, gradients, radii, glows } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      style={{ width: 44, height: 44, borderRadius: radii.full }}
    >
      {active ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.full,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: glows.accent,
          }}
        >
          <Ionicons
            name={icon}
            size={19}
            color={colors.onPrimary}
            style={{ marginLeft: icon === "send" ? -1 : 0 }}
          />
        </LinearGradient>
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceHighlight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={icon}
            size={19}
            color={colors.textFaint}
            style={{ marginLeft: icon === "send" ? -1 : 0 }}
          />
        </View>
      )}
    </PressableScale>
  );
}

/** Four equalizer bars dancing while a voice note is being recorded. */
function RecordingBars({ color }: { color: string }) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  const offsets = [0, 0.25, 0.5, 0.75];
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 22 }}
    >
      {offsets.map((offset) => (
        <Animated.View
          key={offset}
          style={{
            width: 3.5,
            height: 18,
            borderRadius: radii.full,
            backgroundColor: color,
            transform: [
              {
                scaleY: phase.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35 + offset * 0.6, 1.15 - offset * 0.5],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** Centered day separator chip ("Aujourd'hui", "Hier", …). */
function DayChip({ iso }: { iso: string }) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: colors.surfaceHighlight,
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        marginVertical: spacing.sm + 2,
      }}
    >
      <AppText
        variant="small"
        style={{ color: colors.textMuted, letterSpacing: 0.5 }}
      >
        {dayLabel(iso)}
      </AppText>
    </View>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  /** Last bubble of a sender burst — gets the tail corner + avatar. */
  tail: boolean;
  readReceipt?: boolean;
  spacingAfter: number;
  /** Optimistic messages slide in; server-backed ones render instantly. */
  animateIn: boolean;
}

function MessageBubble({
  message,
  mine,
  tail,
  readReceipt,
  spacingAfter,
  animateIn,
}: MessageBubbleProps) {
  const { colors, gradients, radii, shadows } = useTheme();
  const appear = useRef(new Animated.Value(animateIn ? 0 : 1)).current;

  useEffect(() => {
    if (animateIn) {
      Animated.spring(appear, {
        toValue: 1,
        speed: 45,
        bounciness: 6,
        useNativeDriver: true,
      }).start();
    }
  }, [animateIn, appear]);

  const pending = "pending" in message && message.pending;
  const failed = "failed" in message && message.failed;
  const translateY = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  const statusIcon: React.ComponentProps<typeof Ionicons>["name"] | null =
    failed
      ? "warning"
      : pending
        ? "time-outline"
        : readReceipt
          ? "checkmark-done"
          : "checkmark";
  const statusColor = failed
    ? withAlpha(colors.danger, 0.9)
    : pending
      ? withAlpha(colors.onPrimary, 0.5)
      : readReceipt
        ? withAlpha(colors.onPrimary, 0.95)
        : withAlpha(colors.onPrimary, 0.7);

  /** Image/video render edge-to-edge in the bubble; text/voice/file keep the padded body. */
  const isEdgeToEdgeMedia =
    (message.type === "IMAGE" || message.type === "VIDEO") &&
    Boolean(message.attachment);

  const body = (
    <>
      {message.type === "VOICE" && message.attachment ? (
        <VoicePlayer attachment={message.attachment} incoming={!mine} />
      ) : message.type === "IMAGE" ||
        message.type === "VIDEO" ||
        message.type === "FILE" ? (
        message.attachment ? (
          <MediaAttachmentBody message={message} mine={mine} />
        ) : null
      ) : (
        <AppText
          style={{
            color: mine ? colors.onPrimary : colors.text,
            fontSize: 15,
            lineHeight: 21,
          }}
        >
          {message.content}
        </AppText>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          justifyContent: "flex-end",
          marginTop: isEdgeToEdgeMedia ? 6 : 1,
          paddingHorizontal: isEdgeToEdgeMedia ? 10 : 0,
          paddingBottom: isEdgeToEdgeMedia ? 6 : 0,
        }}
      >
        <AppText
          style={{
            fontSize: 10,
            lineHeight: 12,
            color: mine ? withAlpha(colors.onPrimary, 0.66) : colors.textFaint,
            fontVariant: ["tabular-nums"],
          }}
        >
          {new Date(message.createdAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </AppText>
        {mine && statusIcon ? (
          <Ionicons name={statusIcon} size={12} color={statusColor} />
        ) : null}
      </View>
    </>
  );

  return (
    <Animated.View
      style={{
        opacity: appear,
        transform: [{ translateY }],
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: mine ? "flex-end" : "flex-start",
        marginBottom: spacingAfter,
      }}
    >
      {!mine ? (
        tail ? (
          <View style={{ marginRight: 6 }}>
            <UserAvatar user={message.sender} size={26} />
          </View>
        ) : (
          <View style={{ width: 32 }} />
        )
      ) : null}
      <View
        style={{
          maxWidth: "78%",
          borderRadius: BUBBLE_RADIUS,
          overflow: "hidden",
          boxShadow: shadows.bubble,
          backgroundColor: mine ? "transparent" : colors.surfaceElevated,
          borderWidth: mine ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
          borderBottomRightRadius: mine && tail ? 7 : BUBBLE_RADIUS,
          borderBottomLeftRadius: !mine && tail ? 7 : BUBBLE_RADIUS,
          opacity: pending ? 0.7 : 1,
        }}
      >
        {mine ? (
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: isEdgeToEdgeMedia ? 0 : 14,
              paddingVertical: isEdgeToEdgeMedia ? 0 : 8,
              gap: 2,
            }}
          >
            {body}
          </LinearGradient>
        ) : (
          <View
            style={{
              paddingHorizontal: isEdgeToEdgeMedia ? 0 : 14,
              paddingVertical: isEdgeToEdgeMedia ? 0 : 8,
              gap: 2,
            }}
          >
            {body}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
