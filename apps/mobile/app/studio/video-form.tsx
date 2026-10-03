import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useMyArtist, invalidateStudioQueries } from "@/hooks/use-library";
import { artistsApi, type VideoPublishBody } from "@/services/api/artists-api";
import { pickVideoFile, pickImageFile, uploadPickedMedia, type PickedMedia } from "@/services/media/media-picker";
import { AppText, Button, Input } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import { formatFileSize } from "@/utils/format";

/** Publish (no videoId param) or edit (videoId param) a video. */
export default function VideoFormScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    videoId?: string;
    title?: string;
    videoUrl?: string;
    description?: string;
    thumbnailUrl?: string;
    isDownloadable?: string;
  }>();
  const myArtist = useMyArtist();
  const editing = Boolean(params.videoId);

  const [title, setTitle] = useState(params.title ?? "");
  const [videoUrl, setVideoUrl] = useState(params.videoUrl ?? "");
  const [description, setDescription] = useState(params.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(params.thumbnailUrl ?? "");
  const [isDownloadable, setIsDownloadable] = useState(params.isDownloadable !== "false");
  const [pickedVideo, setPickedVideo] = useState<PickedMedia | null>(null);
  const [pickedImage, setPickedImage] = useState<PickedMedia | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(!params.videoUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentThumbnail = pickedImage?.uri ?? (thumbnailUrl || null);

  async function chooseVideo() {
    const media = await pickVideoFile();
    if (media) {
      setPickedVideo(media);
      setShowUrlInput(false);
      setError(null);
    }
  }

  async function chooseImage() {
    const media = await pickImageFile();
    if (media) {
      setPickedImage(media);
      setError(null);
    }
  }

  async function submit() {
    if (!myArtist.data) return;
    if (!title.trim()) {
      setError("Le titre est obligatoire");
      return;
    }
    if (!pickedVideo && !videoUrl.trim()) {
      setError("Choisissez un fichier vidéo ou saisissez une URL");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: VideoPublishBody = {
        title: title.trim(),
        videoUrl: videoUrl.trim(),
        description: description.trim() || null,
        thumbnailUrl: thumbnailUrl.trim() || null,
        isDownloadable,
      };

      if (pickedVideo) {
        const upload = await uploadPickedMedia(pickedVideo, "video");
        body.videoUrl = upload.publicUrl;
        body.mimeType = upload.mimeType;
        body.fileSizeBytes = upload.fileSizeBytes;
        body.storageKey = upload.storageKey;
      }
      if (pickedImage) {
        const upload = await uploadPickedMedia(pickedImage, "image");
        body.thumbnailUrl = upload.publicUrl;
      }

      if (editing) {
        await artistsApi.updateVideo(myArtist.data.id, params.videoId!, body);
      } else {
        await artistsApi.publishVideo(myArtist.data.id, body);
      }
      invalidateStudioQueries(myArtist.data.id, queryClient, "VIDEO");
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la vidéo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
      <AppText variant="heading">{editing ? "Modifier la vidéo" : "Publier une vidéo"}</AppText>

      {/* Video source */}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption">FICHIER VIDÉO</AppText>
        {pickedVideo ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radii.md,
              padding: spacing.md,
            }}
          >
            <Ionicons name="videocam" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: "600" }}>
                {pickedVideo.name}
              </AppText>
              {pickedVideo.fileSizeBytes ? (
                <AppText variant="caption">{formatFileSize(pickedVideo.fileSizeBytes)}</AppText>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setPickedVideo(null)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <Button label="Choisir un fichier vidéo" variant="secondary" icon="videocam-outline" onPress={() => void chooseVideo()} />
        )}
        {showUrlInput ? (
          <Input
            placeholder="Ou collez une URL vidéo (https://…)"
            value={videoUrl}
            onChangeText={setVideoUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        ) : (
          <AppText
            onPress={() => setShowUrlInput(true)}
            style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
          >
            Utiliser une URL à la place
          </AppText>
        )}
      </View>

      {/* Poster */}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption">MINIATURE (OPTIONNEL)</AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Artwork uri={currentThumbnail} seed={title || "video"} label={title || "?"} size={64} radius={radii.md} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Button
              label={currentThumbnail ? "Changer la miniature" : "Choisir une image"}
              variant="secondary"
              icon="image-outline"
              onPress={() => void chooseImage()}
            />
            {currentThumbnail ? (
              <AppText
                onPress={() => {
                  setPickedImage(null);
                  setThumbnailUrl("");
                }}
                style={{ color: colors.danger, fontSize: 13, fontWeight: "600" }}
              >
                Retirer la miniature
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      {/* Metadata */}
      <Input placeholder="Titre" value={title} onChangeText={setTitle} />
      <Input
        placeholder="Description (optionnelle)"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={{ height: 110, textAlignVertical: "top" }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: 15, fontWeight: "500" }}>Téléchargeable par les fans</AppText>
          <AppText variant="caption">Les auditeurs peuvent enregistrer la vidéo hors ligne</AppText>
        </View>
        <Switch
          value={isDownloadable}
          onValueChange={setIsDownloadable}
          trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
      <Button label={editing ? "Enregistrer" : "Publier"} loading={saving} onPress={() => void submit()} />
      <Button label="Annuler" variant="ghost" onPress={() => router.back()} />
      {saving ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <AppText variant="caption">Envoi des fichiers en cours…</AppText>
        </View>
      ) : null}
    </ScrollView>
  );
}
