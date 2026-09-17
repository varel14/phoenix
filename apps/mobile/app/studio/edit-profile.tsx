import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useMyArtist } from "@/hooks/use-library";
import { useAuthStore } from "@/stores/auth-store";
import { artistsApi } from "@/services/api/artists-api";
import { AppText, Button, Input } from "@/components/ui";

export default function EditArtistProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ name?: string; bio?: string }>();
  const myArtist = useMyArtist();
  const refreshSession = useAuthStore((state) => state.refresh);
  const [name, setName] = useState(params.name ?? myArtist.data?.name ?? "");
  const [bio, setBio] = useState(params.bio ?? myArtist.data?.bio ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!myArtist.data || !name.trim()) {
      setError("Artist name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await artistsApi.update(myArtist.data.id, { name: name.trim(), bio: bio.trim() || null });
      await refreshSession();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
      <AppText variant="heading">Edit artist profile</AppText>
      <Input placeholder="Artist name" value={name} onChangeText={setName} />
      <Input placeholder="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={4} style={{ height: 110, textAlignVertical: "top" }} />
      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
      <Button label="Save changes" loading={saving} onPress={() => void save()} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
