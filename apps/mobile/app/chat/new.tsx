import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Contacts from "expo-contacts";
import { conversationsApi } from "@/services/api/chat-api";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  AppText,
  EmptyView,
  IconButton,
  Input,
  LoadingView,
} from "@/components/ui";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

interface ChatContact {
  id: string;
  name: string;
  image: string | null;
  phone: string | null;
}

/**
 * New-chat screen (WhatsApp style): reads the device contact list, matches
 * phone numbers against app users, and narrows down with the name/phone
 * search. Nothing is created here — picking a contact opens the draft chat.
 */
export default function NewChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const trimmed = search.trim();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null,
  );
  const [deviceContacts, setDeviceContacts] = useState<
    Array<{ id: string; name: string; phone: string }>
  >([]);

  // Device contacts: permission + read once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setPermissionGranted(false);
          return;
        }
        const book = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
          pageSize: 5000,
        });
        if (cancelled) return;
        const flat: Array<{ id: string; name: string; phone: string }> = [];
        for (const contact of book.data) {
          for (const number of contact.phoneNumbers ?? []) {
            const phone = number.digits ?? number.number;
            if (phone) {
              flat.push({
                id: `${contact.id}-${phone}`,
                name: contact.name ?? "Contact",
                phone,
              });
            }
          }
        }
        setDeviceContacts(flat);
        setPermissionGranted(true);
      } catch {
        if (!cancelled) setPermissionGranted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Match device phones against app users (server-side suffix matching).
  const matchedQuery = useQuery({
    queryKey: ["contacts-matched", permissionGranted, deviceContacts.length],
    queryFn: () =>
      conversationsApi.matchContacts(
        deviceContacts.map((contact) => contact.phone).slice(0, 500),
      ),
    enabled: permissionGranted === true && deviceContacts.length > 0,
  });

  // Name/phone search over app users (typo-tolerant).
  const searchQuery = useQuery({
    queryKey: ["contacts", trimmed],
    queryFn: () => conversationsApi.searchUsers(trimmed),
    enabled: trimmed.length > 0,
  });

  const matched = matchedQuery.data ?? [];
  const searchResults = searchQuery.data ?? [];
  const dedupedSearch = searchResults.filter(
    (user) => !matched.some((match) => match.id === user.id),
  );

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
            placeholder="Nom ou numéro du contact"
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
        {trimmed.length === 0 ? (
          permissionGranted === null ||
          (matchedQuery.isLoading && deviceContacts.length > 0) ? (
            <LoadingView label="Recherche de vos contacts sur Chuyassi…" />
          ) : permissionGranted === false ? (
            <EmptyView
              title="Accès aux contacts refusé"
              subtitle="Autorisez l'accès aux contacts dans les réglages pour retrouver vos proches, ou recherchez par nom / numéro ci-dessus."
            />
          ) : matched.length === 0 ? (
            <EmptyView
              title="Aucun contact sur Chuyassi"
              subtitle="Aucun de vos contacts n'a encore de numéro enregistré ici — invitez-les !"
            />
          ) : (
            <View style={{ gap: spacing.xs }}>
              <AppText
                variant="small"
                color={colors.textFaint}
                style={{
                  letterSpacing: 1.5,
                  paddingHorizontal: spacing.lg,
                  marginTop: spacing.sm,
                }}
              >
                SUR CHUYASSI — {matched.length}
              </AppText>
              {matched.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))}
            </View>
          )
        ) : searchQuery.isLoading ? (
          <LoadingView label="Recherche…" />
        ) : dedupedSearch.length === 0 ? (
          <EmptyView
            title="Aucun résultat"
            subtitle="Essayez un autre nom ou un numéro de téléphone."
          />
        ) : (
          dedupedSearch.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))
        )}
      </ScrollView>

      {/* Hint */}
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

function ContactRow({ contact }: { contact: ChatContact }) {
  const { colors } = useTheme();
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
        {contact.phone ? (
          <AppText variant="caption" color={colors.textFaint} numberOfLines={1}>
            {contact.phone}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chatbubble-outline" size={18} color={colors.textFaint} />
    </Pressable>
  );
}
