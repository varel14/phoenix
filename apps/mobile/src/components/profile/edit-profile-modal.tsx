import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { authClient } from "@/services/auth/auth-client";
import { uploadFile } from "@/services/api/uploads-api";
import { useAuthStore } from "@/stores/auth-store";
import { AppText, Button, IconButton, Input, PressableScale } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Account editor: change the profile photo (galerie → upload) and display
 * name. Persists through better-auth's update-user, then refreshes the
 * session so every screen picks up the new identity.
 */
export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Insets read 0 inside Android modals; fall back to the status bar height.
  const topInset = insets.top || StatusBar.currentHeight || 0;
  const user = useAuthStore((state) => state.user);
  const refreshSession = useAuthStore((state) => state.refresh);

  const [name, setName] = useState("");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setName(user?.name ?? "");
      setPickedUri(null);
      setUploadedUrl(null);
      setError(null);
    }
  }, [visible, user?.name]);

  async function pickPhoto() {
    if (uploading || saving) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("L'accès à la galerie photo est requis pour changer la photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (!asset) return;

    setPickedUri(asset.uri);
    setUploading(true);
    setError(null);
    try {
      const upload = await uploadFile(asset.uri, "image", asset.mimeType ?? "image/jpeg");
      setUploadedUrl(upload.url);
    } catch (err) {
      setPickedUri(null);
      setError(err instanceof Error ? err.message : "L'envoi de la photo a échoué.");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Le nom doit contenir au moins 2 caractères.");
      return;
    }
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    authClient
      .updateUser({
        name: trimmed,
        ...(uploadedUrl ? { image: uploadedUrl } : {}),
      })
      .then(({ error: authError }) => {
        if (authError) {
          throw new Error(authError.message ?? "La mise à jour a échoué.");
        }
        return refreshSession();
      })
      .then(() => onClose())
      .catch((err) =>
        setError(err instanceof Error ? err.message : "La mise à jour a échoué."),
      )
      .finally(() => setSaving(false));
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topInset }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <IconButton icon="close" size={24} onPress={onClose} accessibilityLabel="Fermer" />
          <AppText
            variant="caption"
            style={{ flex: 1, textAlign: "center", letterSpacing: 2 }}
          >
            MODIFIER LE PROFIL
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: spacing.xl,
              paddingBottom: 60,
              gap: spacing.xl,
            }}
          >
            {/* Photo picker */}
            <View style={{ alignItems: "center", gap: spacing.md }}>
              <PressableScale
                onPress={pickPhoto}
                scaleTo={0.96}
                accessibilityLabel="Changer la photo de profil"
                style={{ alignItems: "center", justifyContent: "center" }}
              >
                <View
                  style={{
                    width: 112,
                    height: 112,
                    borderRadius: radii.full,
                    padding: 3,
                    backgroundColor: colors.surfaceHighlight,
                  }}
                >
                  <Artwork
                    uri={pickedUri ?? user?.image}
                    seed={user?.id ?? "me"}
                    label={user?.name ?? "?"}
                    size={106}
                    radius={radii.full}
                  />
                </View>
                {/* Camera badge */}
                <View
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 36,
                    height: 36,
                    borderRadius: radii.full,
                    borderWidth: 3,
                    borderColor: colors.background,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={uploading ? "cloud-upload-outline" : "camera"}
                    size={15}
                    color={colors.onPrimary}
                  />
                </View>
              </PressableScale>
              <AppText variant="caption" color={colors.textFaint}>
                {uploading
                  ? "Envoi de la photo…"
                  : pickedUri
                    ? "Photo prête — enregistrez pour appliquer"
                    : "Touchez la photo pour en choisir une nouvelle"}
              </AppText>
            </View>

            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="small" color={colors.textFaint} style={{ letterSpacing: 1.2 }}>
                  NOM
                </AppText>
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Votre nom"
                  autoCapitalize="words"
                />
              </View>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="small" color={colors.textFaint} style={{ letterSpacing: 1.2 }}>
                  E-MAIL
                </AppText>
                <View
                  style={{
                    height: 48,
                    borderRadius: radii.full,
                    backgroundColor: colors.surfaceHighlight,
                    paddingHorizontal: spacing.lg,
                    alignItems: "flex-start",
                    justifyContent: "center",
                  }}
                >
                  <AppText variant="body" color={colors.textMuted} numberOfLines={1}>
                    {user?.email}
                  </AppText>
                </View>
              </View>

              {error ? (
                <AppText style={{ color: colors.danger }}>{error}</AppText>
              ) : null}

              <Button
                label="Enregistrer"
                onPress={save}
                loading={saving || uploading}
                disabled={uploading}
                style={{ marginTop: spacing.sm }}
              />
              <Button
                label="Annuler"
                variant="ghost"
                onPress={onClose}
                disabled={saving || uploading}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                backgroundColor: withAlpha(colors.primary, 0.08),
                borderRadius: radii.lg,
                padding: spacing.md,
              }}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <AppText variant="small" color={colors.textMuted} style={{ flex: 1 }}>
                Votre nom et votre photo apparaissent dans les messages, les
                paiements et votre page publique.
              </AppText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
