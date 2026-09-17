import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Link, router } from "expo-router";
import { colors, radii, spacing } from "@/theme";
import { authClient } from "@/services/auth/auth-client";
import { useAuthStore } from "@/stores/auth-store";
import { AppText, Button, Input } from "@/components/ui";

export default function LoginScreen() {
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
        <View style={{ marginBottom: spacing.xxl }}>
          <AppText variant="title">Phoenix</AppText>
          <AppText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
            Music and video, wherever you are.
          </AppText>
        </View>

        <View style={{ gap: spacing.md }}>
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
          <Button label="Sign in" onPress={() => void handleLogin()} loading={loading} />
          <Link href="/(auth)/register" asChild>
            <Button label="Create an account" variant="ghost" />
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const scrollStyle = {
  flexGrow: 1,
  justifyContent: "center" as const,
  padding: spacing.xl,
  borderRadius: radii.md,
};
