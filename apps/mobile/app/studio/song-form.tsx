import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useMyArtist, invalidateStudioQueries } from "@/hooks/use-library";
import { artistsApi, type SongPublishBody } from "@/services/api/artists-api";
import { pickAudioFile, pickImageFile, readAudioDuration, uploadPickedMedia, type PickedMedia } from "@/services/media/media-picker";
import { AppText, Button, Input } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import { formatFileSize } from "@/utils/format";
import { queryKeys } from "@/constants/query-keys";

/** Publish (no songId param) or edit (songId param) a song. */
export default function SongFormScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    songId?: string;
    title?: string;
    audioUrl?: string;
    genre?: string;
    albumName?: string;
    thumbnailUrl?: string;
    isDownloadable?: string;
  }>();
  const myArtist = useMyArtist();
  const editing = Boolean(params.songId);

  const [title, setTitle] = useState(params.title ?? "");
  const [audioUrl, setAudioUrl] = useState(params.audioUrl ?? "");
  const [genre, setGenre] = useState(params.genre ?? "");
  const [albumName, setAlbumName] = useState(params.albumName ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(params.thumbnailUrl ?? "");
  const [isDownloadable, setIsDownloadable] = useState(params.isDownloadable !== "false");
  const [pickedAudio, setPickedAudio] = useState<PickedMedia | null>(null);
  const [pickedImage, setPickedImage] = useState<PickedMedia | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(!params.audioUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentThumbnail = pickedImage?.uri ?? (thumbnailUrl || null);

  async function chooseAudio() {
    const media = await pickAudioFile();
    if (media) {
      setPickedAudio(media);
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
    if (!pickedAudio && !audioUrl.trim()) {
      setError("Choisissez un fichier audio ou saisissez une URL");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: SongPublishBody = {
        title: title.trim(),
        audioUrl: audioUrl.trim(),
        genre: genre.trim() || null,
        albumName: albumName.trim() || null,
        thumbnailUrl: thumbnailUrl.trim() || null,
        isDownloadable,
      };

      if (pickedAudio) {
        const upload = await uploadPickedMedia(pickedAudio, "audio");
        body.audioUrl = upload.publicUrl;
        body.mimeType = upload.mimeType;
        body.fileSizeBytes = upload.fileSizeBytes;
        body.storageKey = upload.storageKey;
        body.durationSec = await readAudioDuration(pickedAudio.uri);
      }
      if (pickedImage) {
        const upload = await uploadPickedMedia(pickedImage, "image");
        body.thumbnailUrl = upload.publicUrl;
      }

      if (editing) {
        await artistsApi.updateSong(myArtist.data.id, params.songId!, body);
      } else {
        await artistsApi.publishSong(myArtist.data.id, body);
      }
      invalidateStudioQueries(myArtist.data.id, queryClient);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le titre");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
      <AppText variant="heading">{editing ? "Modifier le titre" : "Publier un titre"}</AppText>

      {/* Audio source */}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption">FICHIER AUDIO</AppText>
        {pickedAudio ? (
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
            <Ionicons name="musical-notes" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: "600" }}>
                {pickedAudio.name}
              </AppText>
              {pickedAudio.fileSizeBytes ? (
                <AppText variant="caption">{formatFileSize(pickedAudio.fileSizeBytes)}</AppText>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setPickedAudio(null)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <Button label="Choisir un fichier audio" variant="secondary" icon="musical-notes-outline" onPress={() => void chooseAudio()} />
        )}
        {showUrlInput ? (
          <Input
            placeholder="Ou collez une URL audio (https://…)"
            value={audioUrl}
            onChangeText={setAudioUrl}
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

      {/* Artwork */}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption">POCHETTE (OPTIONNEL)</AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Artwork uri={currentThumbnail} seed={title || "song"} label={title || "?"} size={64} radius={radii.md} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Button
              label={currentThumbnail ? "Changer la pochette" : "Choisir une image"}
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
                Retirer la pochette
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      {/* Metadata */}
      <Input placeholder="Titre" value={title} onChangeText={setTitle} />
      <Input placeholder="Genre (optionnel)" value={genre} onChangeText={setGenre} />
      <Input placeholder="Album (optionnel)" value={albumName} onChangeText={setAlbumName} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: 15, fontWeight: "500" }}>Téléchargeable par les fans</AppText>
          <AppText variant="caption">Les auditeurs peuvent enregistrer le titre hors ligne</AppText>
        </View>
        <Switch
          value={isDownloadable}
          onValueChange={setIsDownloadable}
          trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
      <Button
        label={editing ? "Enregistrer" : "Publier"}
        loading={saving}
        onPress={() => void submit()}
      />
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
