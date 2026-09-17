import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useMyArtist } from "@/hooks/use-library";
import { artistsApi, type VideoPublishBody } from "@/services/api/artists-api";
import { AppText, Button, Input } from "@/components/ui";

/** Publish (no videoId param) or edit (videoId param) a video. */
export default function VideoFormScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ videoId?: string; title?: string; videoUrl?: string; description?: string }>();
  const myArtist = useMyArtist();
  const editing = Boolean(params.videoId);

  const [title, setTitle] = useState(params.title ?? "");
  const [videoUrl, setVideoUrl] = useState(params.videoUrl ?? "");
  const [description, setDescription] = useState(params.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!myArtist.data) return;
    if (!title.trim() || !videoUrl.trim()) {
      setError("Title and video URL are required");
      return;
    }
    setSaving(true);
    setError(null);
    const body: VideoPublishBody = {
      title: title.trim(),
      videoUrl: videoUrl.trim(),
      description: description.trim() || null,
      isDownloadable: true,
    };
    try {
      if (editing) {
        await artistsApi.updateVideo(myArtist.data.id, params.videoId!, body);
      } else {
        await artistsApi.publishVideo(myArtist.data.id, body);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the video");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
      <AppText variant="heading">{editing ? "Edit video" : "Publish a video"}</AppText>
      <AppText variant="bodyMuted">
        Media is referenced by URL for now — file uploads arrive with the storage integration.
      </AppText>
      <Input placeholder="Title" value={title} onChangeText={setTitle} />
      <Input placeholder="Video URL (https://…)" value={videoUrl} onChangeText={setVideoUrl} autoCapitalize="none" keyboardType="url" />
      <Input placeholder="Description (optional)" value={description} onChangeText={setDescription} multiline numberOfLines={4} style={{ height: 110, textAlignVertical: "top" }} />
      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
      <Button label={editing ? "Save changes" : "Publish"} loading={saving} onPress={() => void submit()} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
