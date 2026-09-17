import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { AppText, Button, IconButton } from "@/components/ui";

type PlanId = "MONTHLY" | "YEARLY";

const PLANS: Array<{
  id: PlanId;
  name: string;
  price: string;
  period: string;
  note: string;
}> = [
  { id: "MONTHLY", name: "Mensuel", price: "2 500 FCFA", period: "/ mois", note: "Sans engagement" },
  { id: "YEARLY", name: "Annuel", price: "25 000 FCFA", period: "/ an", note: "2 mois offerts" },
];

const FEATURES: Array<{ icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; description: string }> = [
  { icon: "musical-notes", title: "Musique sans limites", description: "Écoutez tous vos titres sans publicité, même hors ligne." },
  { icon: "download", title: "Téléchargements illimités", description: "Gardez votre musique et vos vidéos partout, même sans réseau." },
  { icon: "play-circle", title: "Vidéos exclusives", description: "Clips, concerts et contenus Premium en haute qualité." },
  { icon: "color-palette", title: "Thèmes exclusifs", description: "Personnalisez votre application avec des thèmes réservés aux membres." },
];

/** Mockup "Abonnements" screen — presentational Premium pitch (no payment backend). */
export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, gradients } = useTheme();
  const [selected, setSelected] = useState<PlanId>("YEARLY");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <IconButton icon="chevron-back" size={26} onPress={() => router.back()} accessibilityLabel="Back" />
        <AppText variant="caption" style={{ flex: 1, textAlign: "center", letterSpacing: 2 }}>
          ABONNEMENTS
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120, gap: spacing.xl }}>
        {/* Gold gradient hero */}
        <LinearGradient
          colors={gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radii.lg, padding: spacing.xl, gap: spacing.sm, alignItems: "flex-start" }}
        >
          <Ionicons name="star" size={36} color="#FFFFFF" />
          <AppText variant="title" color="#FFFFFF">
            Phoenix Premium
          </AppText>
          <AppText color="rgba(255,255,255,0.9)" style={{ fontSize: 15 }}>
            Tout votre univers, sans limites. Musique, vidéos et téléchargements hors ligne.
          </AppText>
        </LinearGradient>

        {/* Plan cards */}
        <View style={{ gap: spacing.md }}>
          {PLANS.map((plan) => {
            const active = selected === plan.id;
            return (
              <Pressable
                key={plan.id}
                accessibilityRole="button"
                onPress={() => setSelected(plan.id)}
                style={{
                  borderRadius: radii.lg,
                  borderWidth: 2,
                  borderColor: active ? colors.gold : colors.border,
                  backgroundColor: colors.surface,
                  padding: spacing.lg,
                  gap: spacing.xs,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={active ? colors.gold : colors.textFaint}
                  />
                  <AppText variant="subheading">{plan.name}</AppText>
                  {plan.id === "YEARLY" ? (
                    <View
                      style={{
                        backgroundColor: colors.gold,
                        borderRadius: radii.full,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                      }}
                    >
                      <AppText style={{ color: "#201500", fontSize: 10, fontWeight: "800" }}>POPULAIRE</AppText>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
                  <AppText variant="heading" color={active ? colors.gold : colors.text}>
                    {plan.price}
                  </AppText>
                  <AppText variant="caption">{plan.period}</AppText>
                </View>
                <AppText variant="small">{plan.note}</AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Feature list */}
        <View style={{ gap: spacing.lg }}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
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
                <Ionicons name={feature.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="subheading">{feature.title}</AppText>
                <AppText variant="bodyMuted">{feature.description}</AppText>
              </View>
            </View>
          ))}
        </View>

        <Button label="S'abonner" onPress={() => {}} />
        <AppText variant="small" align="center">
          Annulable à tout moment. Paiement Mobile Money à venir.
        </AppText>
      </ScrollView>
    </View>
  );
}
