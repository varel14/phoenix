import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useAppLock, useAppLockStore } from "@/stores/app-lock-store";
import { appLockApi } from "@/services/api/app-lock-api";
import { ApiError } from "@/services/api/api-client";
import { AppText, Button } from "@/components/ui";
import { PhoenixMark } from "@/components/ui/brand";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";

const CODE_LENGTH = 6;

/**
 * Full-screen gate rendered from the root layout: whenever `useAppLock` is
 * true, the entire application is covered by the unlock screen — including
 * the sign-in flow. The call overlay refuses to show while locked, so a
 * locked device cannot be used for anything.
 */
export function AppLockGate() {
  const locked = useAppLock();
  if (!locked) return null;
  return <AppLockScreen />;
}

function AppLockScreen() {
  const { colors, isDark } = useTheme();
  const unlock = useAppLockStore((state) => state.unlock);

  const inputRef = useRef<TextInput>(null);
  const submitting = useRef(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  async function submit(nextCode: string) {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const result = await appLockApi.verify(nextCode);
      unlock(result);
    } catch (thrown) {
      setCode("");
      requestAnimationFrame(() => inputRef.current?.focus());
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
      setError(
        thrown instanceof ApiError
          ? thrown.code === "NETWORK_ERROR"
            ? "Serveur injoignable — vérifiez votre connexion."
            : thrown.code === "INVALID_UNLOCK_CODE"
              ? "Code incorrect — demandez le code en vigueur."
              : thrown.message
          : "Une erreur est survenue. Réessayez.",
      );
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  function handleChange(text: string) {
    const next = text
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, CODE_LENGTH);
    setCode(next);
    if (next.length === CODE_LENGTH) void submit(next);
  }

  return (
    <Modal visible statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Ambient light — same radial wash as the auth screens. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="lockGlow" cx="0.5" cy="0" rx="1.1" ry="0.9">
                <Stop
                  offset="0"
                  stopColor={colors.primary}
                  stopOpacity={isDark ? 0.24 : 0.14}
                />
                <Stop offset="0.55" stopColor={colors.primary} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#lockGlow)" />
          </Svg>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
        >
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <PhoenixMark size={56} />
            <AppText
              variant="small"
              style={{ letterSpacing: 3, color: colors.primary }}
            >
              CHUYASSI EMMANUEL CE
            </AppText>
            <View style={{ alignItems: "center", gap: 6, marginTop: spacing.sm }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primaryTint,
                }}
              >
                <Ionicons
                  name="lock-closed"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <AppText variant="heading" align="center">
                Application verrouillée
              </AppText>
              <AppText variant="bodyMuted" align="center">
                Par sécurité, l&rsquo;application se verrouille tous les 3
                jours, à compter de sa première utilisation. Entrez le code à{" "}
                {CODE_LENGTH} caractères pour continuer pendant 3 jours de
                plus.
              </AppText>
            </View>
          </View>

          {/* Code cells — the real input is invisible; tapping focuses it. */}
          <Animated.View
            style={{ transform: [{ translateX: shake }], marginTop: spacing.xxl }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Champs du code de déverrouillage"
              onPress={() => inputRef.current?.focus()}
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: spacing.sm,
              }}
            >
              {Array.from({ length: CODE_LENGTH }, (_, index) => {
                const filled = index < code.length;
                return (
                  <View
                    key={index}
                    style={{
                      width: 46,
                      height: 58,
                      borderRadius: radii.md,
                      borderWidth: 1.5,
                      borderColor: filled ? colors.primary : colors.border,
                      backgroundColor: filled
                        ? withAlpha(colors.primary, 0.1)
                        : colors.surfaceMuted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 24,
                        fontWeight: "700",
                        color: filled ? colors.text : colors.textFaint,
                      }}
                    >
                      {filled ? code[index] : ""}
                    </AppText>
                  </View>
                );
              })}
            </Pressable>
          </Animated.View>

          {error ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.xs,
                marginTop: spacing.lg,
              }}
            >
              <Ionicons name="warning-outline" size={15} color={colors.danger} />
              <AppText style={{ color: colors.danger, fontSize: 13, flexShrink: 1 }}>
                {error}
              </AppText>
            </View>
          ) : null}

          <Button
            label="Déverrouiller"
            icon="key"
            onPress={() => {
              if (code.length === CODE_LENGTH) void submit(code);
              else inputRef.current?.focus();
            }}
            loading={loading}
            style={{ marginTop: spacing.xl }}
          />

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            blurOnSubmit={false}
            style={{
              position: "absolute",
              opacity: 0,
              height: 1,
              width: 1,
            }}
          />
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}
