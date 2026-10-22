import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { conversationsApi } from "@/services/api/chat-api";
import { usersApi } from "@/services/api/users-api";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  AppText,
  EmptyView,
  IconButton,
  Input,
  LoadingView,
} from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

/**
 * New-chat screen: the contact list is populated right away (default list
 * when the search is empty) and narrows down with typo-tolerant trigram
 * matching as you type. Selecting a contact opens a draft chat — nothing is
 * created until a message is sent or the chat is left with text in the
 * composer ("brouillon").
 */
export default function NewChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const trimmed = search.trim();

  const contactsQuery = useQuery({
    queryKey: ["contacts", trimmed],
    queryFn: () => conversationsApi.searchUsers(trimmed),
  });

  const contacts = contactsQuery.data ?? [];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <IconButton
            icon="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Retour"
          />
          <AppText variant="heading">Nouvelle discussion</AppText>
        </View>
        <View>
          <Input
            placeholder="Nom du contact"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textFaint}
            style={{ position: "absolute", right: 14, top: 15 }}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingVertical: spacing.md,
          paddingBottom: 120,
        }}
      >
        {contactsQuery.isLoading ? (
          <LoadingView label="Chargement des contacts…" />
        ) : contactsQuery.isError ? (
          <EmptyView
            title="Liste indisponible"
            subtitle={
              (contactsQuery.error as Error)?.message ??
              "Réessayez dans un instant."
            }
          />
        ) : contacts.length === 0 ? (
          <EmptyView
            title="Aucun contact"
            subtitle={
              trimmed.length > 0
                ? "Aucun nom ne ressemble à cette recherche."
                : "Invitez vos proches sur l'application pour discuter avec eux."
            }
          />
        ) : (
          contacts.map((contact) => (
            <Pressable
              key={contact.id}
              accessibilityRole="button"
              accessibilityLabel={`Discuter avec ${contact.name}`}
              onPress={() =>
                router.push({
                  pathname: "/chat/draft",
                  params: { recipientId: contact.id, name: contact.name },
                })
              }
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
              <UserAvatar user={contact} size={46} />
              <View style={{ flex: 1 }}>
                <AppText variant="subheading" numberOfLines={1}>
                  {contact.name}
                </AppText>
              </View>
              <Ionicons
                name="chatbubble-outline"
                size={18}
                color={colors.textFaint}
              />
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Hint pinned at the bottom — explains the draft behavior. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: spacing.lg,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <AppText variant="caption" color={colors.textFaint}>
          La discussion sera créée à l'envoi du premier message.
        </AppText>
      </View>
    </View>
  );
}

/** Contact row: follow chip (request lifecycle) + tap to open the draft chat. */
function ContactRow({
  contact,
}: {
  contact: {
    id: string;
    name: string;
    image: string | null;
    follow: "none" | "pending" | "accepted" | "mutual";
  };
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [follow, setFollow] = useState(contact.follow);
  const [busy, setBusy] = useState(false);

  async function toggleFollow() {
    if (busy || follow === "pending" || follow === "mutual") return;
    setBusy(true);
    try {
      if (follow === "none") {
        await usersApi.follow(contact.id);
        setFollow("pending");
      } else {
        await usersApi.unfollow(contact.id);
        setFollow("none");
      }
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch {
      // network error — state unchanged
    } finally {
      setBusy(false);
    }
  }

  const chipLabel =
    follow === "mutual"
      ? "Ami(e)"
      : follow === "pending"
        ? "En attente"
        : follow === "accepted"
          ? "Abonné(e)"
          : "Suivre";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Discuter avec ${contact.name}`}
      onPress={() =>
        router.push({
          pathname: "/chat/draft",
          params: { recipientId: contact.id, name: contact.name },
        })
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.surfaceHighlight : "transparent",
      })}
    >
      <UserAvatar user={contact} size={46} />
      <View style={{ flex: 1 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {contact.name}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={chipLabel}
        disabled={busy || follow === "pending" || follow === "mutual"}
        onPress={() => void toggleFollow()}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.md,
          height: 32,
          borderRadius: radii.sm + 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor:
            follow === "mutual"
              ? colors.border
              : follow === "none"
                ? colors.primary
                : colors.border,
          backgroundColor:
            follow === "mutual"
              ? colors.primaryTint
              : follow === "none"
                ? colors.primaryTint
                : "transparent",
          opacity: busy ? 0.6 : pressed ? 0.8 : 1,
        })}
      >
        <AppText
          style={{
            fontSize: 11,
            fontWeight: "700",
            color:
              follow === "mutual"
                ? colors.primary
                : follow === "none"
                  ? colors.primary
                  : colors.textMuted,
          }}
        >
          {chipLabel}
        </AppText>
      </Pressable>
    </Pressable>
  );
}
