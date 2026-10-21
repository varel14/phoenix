import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Link, router } from "expo-router";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { authClient } from "@/services/auth/auth-client";
import { useAuthStore } from "@/stores/auth-store";
import { AppText, Button, Input } from "@/components/ui";
import { PhoenixMark } from "@/components/ui/brand";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const refresh = useAuthStore((state) => state.refresh);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your name");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (signUpError) {
        setError(signUpError.message ?? "Could not create your account");
        return;
      }
      await refresh();
      router.replace("/(tabs)");
    } catch {
      setError("Cannot reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      <View style={{ marginBottom: spacing.xxl, gap: spacing.md }}>
        <PhoenixMark size={56} />
        <View style={{ gap: 6 }}>
          <AppText
            variant="small"
            style={{ letterSpacing: 3, color: colors.primary }}
          >
            CHUYASSI EMMANUEL CE
          </AppText>
          <AppText variant="title">Rejoignez le mouvement.</AppText>
          <AppText variant="bodyMuted">
            Écoutez, téléchargez et soutenez vos artistes préférés — créez votre
            compte en moins d'une minute.
          </AppText>
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <Input
          placeholder="Nom complet"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
        <Input
          placeholder="vous@exemple.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          autoCorrect={false}
        />
        <Input
          placeholder="Mot de passe (min. 8 caractères)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? (
          <AppText style={{ color: colors.danger }}>{error}</AppText>
        ) : null}
        <Button
          label="Créer mon compte"
          onPress={() => void handleRegister()}
          loading={loading}
        />
        <Link href="/(auth)/login" asChild>
          <Button label="J'ai déjà un compte" variant="ghost" />
        </Link>
      </View>
    </KeyboardAwareScrollView>
  );
}
