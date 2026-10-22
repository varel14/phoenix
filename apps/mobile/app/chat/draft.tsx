import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api/api-client";
import { conversationsApi } from "@/services/api/chat-api";
import { usersApi } from "@/services/api/users-api";
import { useAuthStore } from "@/stores/auth-store";
import { UserAvatar } from "@/components/chat/user-avatar";
import { AppText, Button, IconButton, Input } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

/**
 * Draft chat ("brouillon"): opened by picking a contact, before any
 * conversation exists. Chatting requires a mutual follow — with a
 * non-mutual contact the screen shows a pending state instead of the
 * composer until the follow request is accepted.
 */
export default function DraftChatScreen() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    recipientId?: string;
    name?: string;
  }>();
  const recipientId = params.recipientId ?? "";
  const recipientName = params.name ?? "Contact";

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  /** Guards against creating the conversation twice (send + exit race). */
  const materializedRef = useRef(false);
  const draftRef = useRef("");
  draftRef.current = draft;

  // Chat requires a mutual follow — fetch the request state for this contact.
  const followState = useQuery({
    queryKey: ["follow-state", recipientId],
    queryFn: () => usersApi.followState(recipientId),
    enabled: recipientId.length > 0,
  });
  const locked = !!followState.data && followState.data.status !== "accepted";

  async function createConversation(options: { draft: boolean }) {
    if (materializedRef.current || !recipientId) return null;
    materializedRef.current = true;
    try {
      const conversation = await conversationsApi.create(recipientId, {
        draft: options.draft,
        ...(options.draft
          ? {}
          : {
              message: {
                type: "TEXT" as const,
                content: draftRef.current.trim(),
              },
            }),
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      return conversation;
    } catch {
      materializedRef.current = false;
      return null;
    }
  }

  /** Leaving the screen: keep the text as a draft conversation, if any. */
  async function persistDraftAndExit() {
    const hasText = draftRef.current.trim().length > 0;
    if (!hasText || materializedRef.current || locked) {
      router.back();
      return;
    }
    setSavingDraft(true);
    const conversation = await createConversation({ draft: true });
    setSavingDraft(false);
    if (conversation) router.replace(`/chat/${conversation.id}`);
    else router.back();
  }

  async function sendFirstMessage() {
    const content = draft.trim();
    if (!content || busy || !recipientId) return;
    setBusy(true);
    materializedRef.current = true;
    try {
      const conversation = await conversationsApi.create(recipientId, {
        message: { type: "TEXT", content },
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // Swap this draft screen for the real conversation thread.
      router.replace(`/chat/${conversation.id}`);
    } catch (error) {
      materializedRef.current = false;
      setBusy(false);
      // Not mutual yet: send the follow request and show the pending state.
      if (
        error instanceof ApiError &&
        error.code === "FOLLOW_REQUIRED" &&
        followState.data?.status === "none"
      ) {
        await usersApi.follow(recipientId);
        await queryClient.invalidateQueries({
          queryKey: ["follow-state", recipientId],
        });
      }
    }
  }

  async function requestFollow() {
    try {
      await usersApi.follow(recipientId);
      await queryClient.invalidateQueries({
        queryKey: ["follow-state", recipientId],
      });
    } catch {
      // Network error — the button stays available.
    }
  }

  // Hardware/gesture back must also honor the draft text.
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (
        materializedRef.current ||
        draftRef.current.trim().length === 0 ||
        locked
      ) {
        return;
      }
      event.preventDefault();
      void persistDraftAndExit();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, locked]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
        }}
      >
        <IconButton
          icon="chevron-back"
          onPress={() => void persistDraftAndExit()}
          accessibilityLabel="Retour"
        />
        <UserAvatar
          user={{ id: recipientId, name: recipientName, image: null }}
          size={40}
        />
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {recipientName}
          </AppText>
          {locked ? (
            <AppText style={{ fontSize: 11, color: colors.gold }}>
              {followState.data?.status === "pending"
                ? "En attente d'acceptation"
                : "Discussion privée"}
            </AppText>
          ) : null}
        </View>
      </View>

      {locked ? (
        /* Pending state: chat unlocks once the follow request is accepted. */
        <ScrollView
          contentContainerStyle={{
            flex: 1,
            justifyContent: "center",
            padding: spacing.xl,
          }}
        >
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radii.full,
                backgroundColor: colors.primaryTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={
                  followState.data?.status === "pending"
                    ? "time-outline"
                    : "person-add-outline"
                }
                size={30}
                color={colors.primary}
              />
            </View>
            <AppText variant="subheading" align="center">
              {followState.data?.status === "pending"
                ? "En attente d'acceptation"
                : "Discussion privée"}
            </AppText>
            <AppText variant="bodyMuted" align="center">
              {followState.data?.status === "pending"
                ? `Votre demande a été envoyée à ${recipientName}. Vous pourrez discuter dès qu'elle sera acceptée.`
                : `Pour discuter avec ${recipientName}, suivez cette personne — la discussion s'ouvrira une fois votre demande acceptée.`}
            </AppText>
            {followState.data?.status === "none" ? (
              <Button
                label="Demander à suivre"
                onPress={() => void requestFollow()}
              />
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              flex: 1,
              justifyContent: "center",
              padding: spacing.xl,
            }}
          >
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radii.full,
                  backgroundColor: colors.primaryTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={28}
                  color={colors.primary}
                />
              </View>
              <AppText variant="subheading" align="center">
                Écrivez le premier message
              </AppText>
              <AppText variant="bodyMuted" align="center">
                La discussion avec {recipientName} n'existe pas encore. Elle
                sera créée dès l'envoi de votre message — ou conservée comme
                brouillon.
              </AppText>
            </View>
          </ScrollView>

          {/* Composer */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              padding: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            }}
          >
            <Input
              placeholder="Votre message…"
              value={draft}
              onChangeText={setDraft}
              multiline
              style={{ flex: 1, height: 44 }}
              onSubmitEditing={() => void sendFirstMessage()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Envoyer le message"
              disabled={busy || savingDraft || draft.trim().length === 0}
              onPress={() => void sendFirstMessage()}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: radii.full,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                opacity: draft.trim().length === 0 ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {busy || savingDraft ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginLeft: 2 }}
                  />
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
