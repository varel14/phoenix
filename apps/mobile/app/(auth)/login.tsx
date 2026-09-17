import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Link, router } from "expo-router";
import { spacing, radii } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { authClient } from "@/services/auth/auth-client";
import { useAuthStore } from "@/stores/auth-store";
import { AppText, Button, Input } from "@/components/ui";
import { BrandTagline, PhoenixLogo } from "@/components/ui/brand";

export default function LoginScreen() {
  const { colors } = useTheme();
  const refresh = useAuthStore((state) => state.refresh);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email: email.trim(), password });
      if (signInError) {
        setError(signInError.message ?? "Invalid email or password");
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
      <ScrollView contentContainerStyle={scrollStyle} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: spacing.xxl, alignItems: "center", gap: spacing.md }}>
          <PhoenixLogo />
          <BrandTagline />
        </View>

        <View style={{ gap: spacing.md }}>
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
          {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
          <Button label="Se connecter" onPress={() => void handleLogin()} loading={loading} />
          <Link href="/(auth)/register" asChild>
            <Button label="Créer un compte" variant="ghost" />
          </Link>
        </View>

        {__DEV__ ? (
          <View
            style={{
              marginTop: spacing.xl,
              backgroundColor: colors.surface,
              borderRadius: radii.md,
              padding: spacing.md,
              gap: 4,
            }}
          >
            <AppText variant="small">COMPTES DE DÉMO (mot de passe : phoenix123)</AppText>
            <AppText variant="caption">Auditeur — listener@phoenix.local</AppText>
            <AppText variant="caption">Créateur — aurora@phoenix.local</AppText>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const scrollStyle = {
  flexGrow: 1,
  justifyContent: "center" as const,
  padding: spacing.xl,
};
