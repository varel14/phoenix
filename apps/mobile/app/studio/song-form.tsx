import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing } from "@/theme";
import { useMyArtist } from "@/hooks/use-library";
import { artistsApi, type SongPublishBody } from "@/services/api/artists-api";
import { AppText, Button, Input } from "@/components/ui";

/** Publish (no songId param) or edit (songId param) a song. */
export default function SongFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ songId?: string; title?: string; audioUrl?: string; genre?: string; albumName?: string }>();
  const myArtist = useMyArtist();
  const editing = Boolean(params.songId);

  const [title, setTitle] = useState(params.title ?? "");
  const [audioUrl, setAudioUrl] = useState(params.audioUrl ?? "");
  const [genre, setGenre] = useState(params.genre ?? "");
  const [albumName, setAlbumName] = useState(params.albumName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!myArtist.data) return;
    if (!title.trim() || !audioUrl.trim()) {
      setError("Title and audio URL are required");
      return;
    }
    setSaving(true);
    setError(null);
    const body: SongPublishBody = {
      title: title.trim(),
      audioUrl: audioUrl.trim(),
      genre: genre.trim() || null,
      albumName: albumName.trim() || null,
      isDownloadable: true,
    };
    try {
      if (editing) {
        await artistsApi.updateSong(myArtist.data.id, params.songId!, body);
      } else {
        await artistsApi.publishSong(myArtist.data.id, body);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the song");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
      <AppText variant="heading">{editing ? "Edit song" : "Publish a song"}</AppText>
      <AppText variant="bodyMuted">
        Media is referenced by URL for now — file uploads arrive with the storage integration.
      </AppText>
      <Input placeholder="Title" value={title} onChangeText={setTitle} />
      <Input placeholder="Audio URL (https://…)" value={audioUrl} onChangeText={setAudioUrl} autoCapitalize="none" keyboardType="url" />
      <Input placeholder="Genre (optional)" value={genre} onChangeText={setGenre} />
      <Input placeholder="Album (optional)" value={albumName} onChangeText={setAlbumName} />
      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
      <Button label={editing ? "Save changes" : "Publish"} loading={saving} onPress={() => void submit()} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
