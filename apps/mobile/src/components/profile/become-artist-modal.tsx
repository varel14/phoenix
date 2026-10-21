import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useBecomeArtist } from "@/hooks/use-library";
import { useAuthStore } from "@/stores/auth-store";
import { AppText, Button, IconButton, Input } from "@/components/ui";

const BENEFITS: Array<{ icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }> = [
  { icon: "cloud-upload-outline", text: "Publiez vos musiques et vos vidéos" },
  { icon: "stats-chart-outline", text: "Suivez les statistiques d'écoute de vos titres" },
  { icon: "people-outline", text: "Faites-vous suivre par vos fans" },
  { icon: "globe-outline", text: "Une page artiste publique, à votre image" },
];

interface BecomeArtistModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Full-screen creator onboarding: pitch, artist name + bio, then role upgrade. */
export function BecomeArtistModal({ visible, onClose }: BecomeArtistModalProps) {
  const { colors, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  // Insets read 0 inside Android modals; fall back to the status bar height.
  const topInset = insets.top || StatusBar.currentHeight || 0;
  const refreshSession = useAuthStore((state) => state.refresh);
  const becomeArtist = useBecomeArtist();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) {
      setError("Le nom d'artiste est requis.");
      return;
    }
    setError(null);
    becomeArtist.mutate(
      { name: name.trim(), bio: bio.trim() || null },
      {
        onSuccess: () => {
          void refreshSession();
          setName("");
          setBio("");
          onClose();
        },
        onError: (err) => setError(err instanceof Error ? err.message : "La création du profil a échoué."),
      },
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topInset }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <IconButton icon="close" size={24} onPress={onClose} accessibilityLabel="Fermer" />
          <AppText variant="caption" style={{ flex: 1, textAlign: "center", letterSpacing: 2 }}>
            ESPACE CRÉATEUR
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: radii.lg, padding: spacing.xl, gap: spacing.sm, alignItems: "flex-start" }}
            >
              <Ionicons name="mic" size={32} color={colors.onPrimary} />
              <AppText variant="heading" color={colors.onPrimary}>
                Lancez votre carrière sur Chuyassi Emmanuel CE
              </AppText>
              <AppText color="rgba(10,10,10,0.8)">
                Créez votre profil artiste gratuitement et partagez votre univers avec la communauté.
              </AppText>
            </LinearGradient>

            <View style={{ gap: spacing.lg }}>
              {BENEFITS.map((benefit) => (
                <View key={benefit.text} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radii.md,
                      backgroundColor: colors.primaryTint,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={benefit.icon} size={18} color={colors.primary} />
                  </View>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {benefit.text}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={{ gap: spacing.md }}>
              <AppText variant="subheading">Votre profil d'artiste</AppText>
              <Input placeholder="Nom d'artiste" value={name} onChangeText={setName} />
              <Input
                placeholder="Courte bio (optionnel)"
                value={bio}
                onChangeText={setBio}
                multiline
                style={{ height: 110, textAlignVertical: "top", paddingTop: spacing.md }}
              />
              {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
              <Button label="Créer mon profil créateur" onPress={submit} loading={becomeArtist.isPending} />
              <Button label="Plus tard" variant="ghost" onPress={onClose} disabled={becomeArtist.isPending} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
