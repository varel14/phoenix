import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Link, router } from "expo-router";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { authClient } from "@/services/auth/auth-client";
import { useAuthStore } from "@/stores/auth-store";
import { AppText, Button, Input } from "@/components/ui";
import { PhoenixLogo } from "@/components/ui/brand";

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
      setError("Cannot reach the Phoenix server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: spacing.xxl, alignItems: "center", gap: spacing.md }}>
          <PhoenixLogo size={64} />
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <AppText variant="title">Rejoignez Phoenix</AppText>
            <AppText variant="bodyMuted" align="center">
              Stream songs and videos, build playlists, listen offline.
            </AppText>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <Input placeholder="Nom" value={name} onChangeText={setName} autoComplete="name" />
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            placeholder="Mot de passe (min. 8 caractères)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
          <Button label="Créer un compte" onPress={() => void handleRegister()} loading={loading} />
          <Link href="/(auth)/login" asChild>
            <Button label="I already have an account" variant="ghost" />
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
