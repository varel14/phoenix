import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { AppText, Button, IconButton } from "@/components/ui";
import { subscriptionsApi } from "@/services/api/subscriptions-api";
import { queryKeys } from "@/constants/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/services/api/api-client";

const FEATURES: Array<{
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
}> = [
  {
    icon: "person-circle",
    title: "Accès à la page de l'artiste",
    description:
      "Soutenez Chuyassi Emmanuel en vous abonnant à sa page pour seulement 2 500 FCFA par mois.",
  },
  {
    icon: "download",
    title: "Musiques téléchargeables",
    description: "Téléchargez les titres et gardez-les sur votre téléphone.",
  },
  {
    icon: "cloud-offline",
    title: "Lecture hors connexion",
    description: "Écoutez vos musiques téléchargées partout, même sans réseau.",
  },
  {
    icon: "heart",
    title: "1 FCFA/mois reversés à l'artiste",
    description:
      "Chaque musique téléchargée coûte 1 FCFA par mois, versés à l'artiste sous couvert de votre abonnement à sa page.",
  },
];

function formatAmount(amount: number, currency: string): string {
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${amount.toLocaleString("fr-FR")} ${label}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "Abonnements" screen — page subscription at 2 500 FCFA/month. */
export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, gradients } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [subscribing, setSubscribing] = useState(false);

  const statusQuery = useQuery({
    queryKey: queryKeys.subscription(),
    queryFn: () => subscriptionsApi.getStatus(),
    enabled: !!user,
    retry: false,
  });

  const subscribeMutation = useMutation({
    mutationFn: () => subscriptionsApi.subscribe(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription() });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      Alert.alert(
        "Abonnement activé",
        "Bienvenue ! Votre abonnement à la page de l'artiste est actif — 2 500 FCFA ont été débités de votre portefeuille. Chaque musique téléchargée reversera 1 FCFA par mois à l'artiste.",
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "INSUFFICIENT_BALANCE") {
        Alert.alert(
          "Solde insuffisant",
          `L'abonnement coûte ${monthlyPrice} par mois. Rechargez votre portefeuille pour continuer.`,
          [
            { text: "Plus tard", style: "cancel" },
            { text: "Recharger", onPress: () => router.push("/pay") },
          ],
        );
        return;
      }
      Alert.alert(
        "Échec de l'abonnement",
        error instanceof ApiError && error.status !== 0
          ? error.message
          : "Impossible de contacter le serveur. Vérifiez votre connexion.",
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => subscriptionsApi.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription() });
      Alert.alert(
        "Abonnement annulé",
        "Vous ne serez plus prélevé. Vos musiques téléchargées resteront lisibles hors connexion.",
      );
    },
    onError: () => {
      Alert.alert("Échec", "Impossible d'annuler l'abonnement pour le moment.");
    },
  });

  const handleSubscribe = () => {
    if (!user) {
      Alert.alert(
        "Connexion requise",
        "Connectez-vous pour vous abonner à la page de l'artiste.",
        [
          { text: "Plus tard", style: "cancel" },
          // returnTo resumes the subscription right after sign-in.
          {
            text: "Se connecter",
            onPress: () =>
              router.push({
                pathname: "/(auth)/login",
                params: { returnTo: "/premium" },
              }),
          },
        ],
      );
      return;
    }
    setSubscribing(true);
    subscribeMutation.mutate(undefined, {
      onSettled: () => setSubscribing(false),
    });
  };

  const handleCancel = () => {
    Alert.alert(
      "Annuler l'abonnement",
      `Votre abonnement à la page de l'artiste (${formatAmount(
        statusQuery.data?.pricing.monthlyPrice ?? 2500,
        statusQuery.data?.pricing.currency ?? "XOF",
      )}/mois) prendra fin immédiatement. Confirmer ?`,
      [
        { text: "Garder mon abonnement", style: "cancel" },
        {
          text: "Annuler l'abonnement",
          style: "destructive",
          onPress: () => cancelMutation.mutate(),
        },
      ],
    );
  };

  const status = statusQuery.data;
  const subscription = status?.subscription;
  const isActive = !!subscription && subscription.status === "ACTIVE";
  const monthlyPrice = formatAmount(
    status?.pricing.monthlyPrice ?? 2500,
    status?.pricing.currency ?? "XOF",
  );
  const royalty = status?.pricing.downloadRoyalty ?? 1;

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
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <IconButton
          icon="chevron-back"
          size={26}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
        <AppText
          variant="caption"
          style={{ flex: 1, textAlign: "center", letterSpacing: 2 }}
        >
          ABONNEMENTS
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: 120,
          gap: spacing.xl,
        }}
      >
        {/* Gold gradient hero */}
        <LinearGradient
          colors={gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radii.lg,
            padding: spacing.xl,
            gap: spacing.sm,
            alignItems: "flex-start",
          }}
        >
          <Ionicons name="star" size={36} color="#FFFFFF" />
          <AppText variant="title" color="#FFFFFF">
            Chuyassi Emmanuel CE
          </AppText>
          <AppText color="rgba(255,255,255,0.9)" style={{ fontSize: 15 }}>
            Abonnez-vous à la page de l'artiste, téléchargez ses musiques et
            écoutez-les hors connexion.
          </AppText>
        </LinearGradient>

        {/* Active subscription card */}
        {isActive && subscription ? (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                borderRadius: radii.lg,
                borderWidth: 2,
                borderColor: colors.gold,
                backgroundColor: colors.surface,
                padding: spacing.lg,
                gap: spacing.xs,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.gold}
                />
                <AppText variant="subheading">Abonnement actif</AppText>
              </View>
              <AppText variant="heading" color={colors.gold}>
                {monthlyPrice}
                <AppText variant="caption"> / mois</AppText>
              </AppText>
              <AppText variant="small">
                Renouvellement le {formatDate(subscription.currentPeriodEnd)}
              </AppText>
              {subscription.artist ? (
                <AppText variant="small">
                  Page de {subscription.artist.name}
                </AppText>
              ) : null}
            </View>

            <View
              style={{
                borderRadius: radii.lg,
                backgroundColor: colors.surface,
                padding: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <AppText variant="subheading">
                Redevance musiques téléchargées
              </AppText>
              <AppText variant="bodyMuted">
                {royalty} FCFA par mois et par musique téléchargée, reversés à
                l'artiste sous couvert de votre abonnement.
              </AppText>
              <View style={{ flexDirection: "row", gap: spacing.xl }}>
                <View style={{ gap: 2 }}>
                  <AppText variant="heading">
                    {status?.usage.downloadedTracks ?? 0}
                  </AppText>
                  <AppText variant="caption">Musique(s) téléchargée(s)</AppText>
                </View>
                <View style={{ gap: 2 }}>
                  <AppText variant="heading">
                    {status?.usage.royaltyDueThisMonth ?? 0} F
                  </AppText>
                  <AppText variant="caption">Dû ce mois-ci</AppText>
                </View>
                <View style={{ gap: 2 }}>
                  <AppText variant="heading">
                    {status?.usage.royaltyTotal ?? 0} F
                  </AppText>
                  <AppText variant="caption">Total versé</AppText>
                </View>
              </View>
            </View>

            <Button
              label="Se désabonner"
              variant="secondary"
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
              loading={cancelMutation.isPending}
            />
          </View>
        ) : (
          /* Plan card */
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                borderRadius: radii.lg,
                borderWidth: 2,
                borderColor: colors.gold,
                backgroundColor: colors.surface,
                padding: spacing.lg,
                gap: spacing.xs,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Ionicons
                  name="radio-button-on"
                  size={20}
                  color={colors.gold}
                />
                <AppText variant="subheading">Abonnement mensuel</AppText>
                <View
                  style={{
                    backgroundColor: colors.gold,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                  }}
                >
                  <AppText
                    style={{
                      color: "#201500",
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    SANS ENGAGEMENT
                  </AppText>
                </View>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: spacing.xs,
                }}
              >
                <AppText variant="heading" color={colors.gold}>
                  {monthlyPrice}
                </AppText>
                <AppText variant="caption">/ mois</AppText>
              </View>
              <AppText variant="small">
                Accès à la page de l'artiste, téléchargements et lecture hors
                connexion.
              </AppText>
            </View>
          </View>
        )}

        {/* Feature list */}
        <View style={{ gap: spacing.lg }}>
          {FEATURES.map((feature) => (
            <View
              key={feature.title}
              style={{
                flexDirection: "row",
                gap: spacing.md,
                alignItems: "flex-start",
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.md,
                  backgroundColor: colors.primaryTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={feature.icon}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="subheading">{feature.title}</AppText>
                <AppText variant="bodyMuted">{feature.description}</AppText>
              </View>
            </View>
          ))}
        </View>

        {isActive ? null : (
          <Button
            label={`S'abonner — ${monthlyPrice}/mois`}
            onPress={handleSubscribe}
            disabled={subscribing}
            loading={subscribing}
          />
        )}

        <AppText variant="small" align="center">
          {royalty} FCFA par mois et par musique téléchargée, reversés à
          l'artiste. Lecture hors connexion incluse pour les musiques
          téléchargées. Annulable à tout moment.
        </AppText>
      </ScrollView>
    </View>
  );
}
