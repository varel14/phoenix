import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { authClient } from "@/services/auth/auth-client";
import { useAuthStore } from "@/stores/auth-store";
import { AppText, Button, Input } from "@/components/ui";
import { PhoenixMark } from "@/components/ui/brand";

type SocialProvider = "google" | "apple";

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const refresh = useAuthStore((state) => state.refresh);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(
    null,
  );

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message ?? "E-mail ou mot de passe incorrect");
        return;
      }
      await refresh();
      router.replace("/(tabs)");
    } catch {
      setError("Serveur injoignable — vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSocial(provider: SocialProvider) {
    setError(null);
    setSocialLoading(provider);
    try {
      const { error: socialError } = await authClient.signIn.social({
        provider,
      });
      if (socialError) {
        setError(
          provider === "google"
            ? "Connexion Google indisponible pour le moment."
            : "Connexion Apple indisponible pour le moment.",
        );
        return;
      }
      await refresh();
      router.replace("/(tabs)");
    } catch {
      setError("Serveur injoignable — vérifiez votre connexion.");
    } finally {
      setSocialLoading(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Ambient light — true radial glow falling in from the top-right corner. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Wide elliptical wash centered on the corner. */}
            <RadialGradient id="cornerGlow" cx="1" cy="0" rx="1.15" ry="0.95">
              <Stop
                offset="0"
                stopColor={colors.primary}
                stopOpacity={isDark ? 0.26 : 0.15}
              />
              <Stop
                offset="0.45"
                stopColor={colors.primary}
                stopOpacity={isDark ? 0.1 : 0.05}
              />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </RadialGradient>
            {/* Hot core hugging the corner for depth. */}
            <RadialGradient id="cornerCore" cx="1" cy="0" r="0.42">
              <Stop
                offset="0"
                stopColor={colors.primary}
                stopOpacity={isDark ? 0.2 : 0.1}
              />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#cornerGlow)" />
          <Rect width="100%" height="100%" fill="url(#cornerCore)" />
        </Svg>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={scrollStyle}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Brand */}
        <View style={{ gap: spacing.lg }}>
          <PhoenixMark size={56} />
          <View style={{ gap: 6 }}>
            <AppText
              variant="small"
              style={{ letterSpacing: 3, color: colors.primary }}
            >
              CHUYASSI EMMANUEL CE
            </AppText>
            <AppText variant="title">Bon retour parmi nous.</AppText>
            <AppText variant="bodyMuted">
              Votre musique, vos créateurs et votre portefeuille — réunis dans
              une seule application.
            </AppText>
          </View>
        </View>

        {/* Credentials */}
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Input
            placeholder="vous@exemple.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            autoCorrect={false}
          />
          <View>
            <Input
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              style={{ paddingRight: 48 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
              onPress={() => setShowPassword((value) => !value)}
              style={{
                position: "absolute",
                right: 12,
                top: 0,
                bottom: 0,
                width: 36,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textFaint}
              />
            </Pressable>
          </View>

          {error ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Ionicons
                name="warning-outline"
                size={15}
                color={colors.danger}
              />
              <AppText style={{ color: colors.danger, fontSize: 13, flex: 1 }}>
                {error}
              </AppText>
            </View>
          ) : null}

          <Button
            label="Se connecter"
            onPress={() => void handleLogin()}
            loading={loading}
          />
        </View>

        {/* Social sign-in */}
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{ flex: 1, height: 1, backgroundColor: colors.hairline }}
            />
            <AppText
              variant="small"
              style={{ letterSpacing: 1.5, color: colors.textFaint }}
            >
              CONTINUER AVEC
            </AppText>
            <View
              style={{ flex: 1, height: 1, backgroundColor: colors.hairline }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <SocialButton
              provider="google"
              icon="logo-google"
              label="Google"
              loading={socialLoading === "google"}
              disabled={socialLoading !== null}
              onPress={() => void handleSocial("google")}
            />
            <SocialButton
              provider="apple"
              icon="logo-apple"
              label="Apple"
              loading={socialLoading === "apple"}
              disabled={socialLoading !== null}
              onPress={() => void handleSocial("apple")}
            />
          </View>
        </View>

        {/* Discreet sign-up */}
        <View
          style={{
            marginTop: spacing.xl,
            flexDirection: "row",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <AppText variant="caption" color={colors.textFaint}>
            Pas encore de compte ?
          </AppText>
          <Link href="/(auth)/register" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Créer un compte"
            >
              {({ pressed }) => (
                <AppText
                  variant="caption"
                  style={{
                    color: colors.primary,
                    fontWeight: "700",
                    opacity: pressed ? 0.7 : 1,
                  }}
                >
                  Créer un compte
                </AppText>
              )}
            </Pressable>
          </Link>
        </View>
      </KeyboardAwareScrollView>

      {/* Copyright pinned to the bottom of the screen */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: spacing.xl,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <AppText variant="small" color={colors.textFaint}>
          © 2026 Chuyassi Emmanuel CE — Tous droits réservés
        </AppText>
      </View>
    </View>
  );
}

/** Quiet outline button for OAuth providers. */
function SocialButton({
  provider,
  icon,
  label,
  loading,
  disabled,
  onPress,
}: {
  provider: SocialProvider;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continuer avec ${label}`}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed
          ? colors.surfaceHighlight
          : colors.surfaceMuted,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        opacity: disabled && !loading ? 0.6 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Ionicons name={icon} size={18} color={colors.text} />
      )}
      <AppText
        style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}
        numberOfLines={1}
      >
        {provider === "google" ? "Google" : "Apple"}
      </AppText>
    </Pressable>
  );
}

const scrollStyle = {
  flexGrow: 1,
  justifyContent: "center" as const,
  padding: spacing.xl,
  // Keep the centered content clear of the pinned copyright.
  paddingBottom: 96,
};
