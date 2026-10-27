import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView, type VideoThumbnail } from "expo-video";
import { AppText } from "@/components/ui";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatFileSize } from "@/utils/format";
import { API_URL } from "@/services/api/api-client";
import {
  resolveSentMedia,
  sentMediaSourceUrl,
} from "@/services/media/sent-media-cache";
import type { Message, MessageAttachment } from "@/types/chat";

const MEDIA_WIDTH = 240;

/** Attachment URLs may be relative ("/uploads/…") in local-storage mode. */
export function resolveAttachmentUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

/**
 * Local-first URI for a bubble's media: attachments the user sent from this
 * device render straight from the picked file instead of re-fetching the
 * server copy; everything else resolves to the remote URL.
 */
function attachmentUri(attachment: MessageAttachment): string {
  const remote = sentMediaSourceUrl(attachment.url);
  return resolveSentMedia(attachment.storageKey, remote) ?? remote;
}

interface MediaBodyProps {
  /** Structural view of Message | OptimisticMessage — bubbles pass either. */
  message: {
    type: Message["type"];
    content: string | null;
    attachment?: MessageAttachment | null;
  };
  mine: boolean;
}

/** Bubble body for IMAGE / VIDEO / FILE messages. Media renders edge-to-edge. */
export function MediaAttachmentBody({ message, mine }: MediaBodyProps) {
  const attachment = message.attachment;
  if (!attachment) return null;
  const caption = message.content?.trim();

  return (
    <View>
      {message.type === "IMAGE" ? <ImageBody attachment={attachment} /> : null}
      {message.type === "VIDEO" ? <VideoBody attachment={attachment} /> : null}
      {message.type === "FILE" ? (
        <FileBody attachment={attachment} mine={mine} />
      ) : null}
      {caption ? (
        <AppText
          style={{
            color: mine ? "rgba(10,10,10,0.92)" : "rgba(255,255,255,0.92)",
            fontSize: 15,
            lineHeight: 21,
            paddingHorizontal: message.type === "FILE" ? 0 : 12,
            paddingTop: message.type === "FILE" ? 0 : 6,
          }}
        >
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

/* ---------------------------------- image ---------------------------------- */

function ImageBody({ attachment }: { attachment: MessageAttachment }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const uri = attachmentUri(attachment);
  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Agrandir l'image"
        onPress={() => setViewerOpen(true)}
      >
        <Image
          source={{ uri }}
          style={{
            width: MEDIA_WIDTH,
            height: 240,
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
          contentFit="cover"
          transition={150}
          recyclingKey={attachment.id}
        />
      </Pressable>
      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={{ flex: 1 }}
            onPress={() => setViewerOpen(false)}
          >
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
          </Pressable>
          <CloseOverlayButton onPress={() => setViewerOpen(false)} />
        </View>
      </Modal>
    </>
  );
}

/* ---------------------------------- video ---------------------------------- */

const thumbnailCache = new Map<string, VideoThumbnail>();

function VideoBody({ attachment }: { attachment: MessageAttachment }) {
  const [open, setOpen] = useState(false);
  const [thumb, setThumb] = useState<VideoThumbnail | null>(
    () => thumbnailCache.get(attachment.id) ?? null,
  );
  const sourceUri = attachmentUri(attachment);
  // A paused player exists only to render the poster frame.
  const player = useVideoPlayer({ uri: sourceUri }, (p) => {
    p.pause();
  });

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cached = thumbnailCache.get(attachment.id);
    if (cached) {
      setThumb(cached);
      return;
    }
    (async () => {
      try {
        const thumbnails = await Promise.race([
          player.generateThumbnailsAsync(0.1, { maxWidth: 480 }),
          new Promise<VideoThumbnail[]>((resolve) => {
            timeoutId = setTimeout(() => resolve([]), 8000);
          }),
        ]);
        const generated = thumbnails[0];
        if (!cancelled && generated) {
          thumbnailCache.set(attachment.id, generated);
          setThumb(generated);
        }
      } catch {
        // Poster stays on the placeholder tile.
      }
    })();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, attachment.id]);

  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Lire la vidéo"
        onPress={() => setOpen(true)}
      >
        <View
          style={{
            width: MEDIA_WIDTH,
            height: 150,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          {thumb ? (
            <Image
              source={thumb}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : null}
          {/* Play badge + duration chip */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.45)",
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.85)",
              }}
            >
              <Ionicons
                name="play"
                size={22}
                color="#FFFFFF"
                style={{ marginLeft: 2 }}
              />
            </View>
          </View>
          {attachment.durationSec ? (
            <View
              style={{
                position: "absolute",
                right: 8,
                bottom: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: radii.sm,
                backgroundColor: "rgba(0,0,0,0.55)",
              }}
            >
              <AppText
                style={{
                  color: "#FFFFFF",
                  fontSize: 10,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {attachment.durationSec}s
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
      {open ? (
        <FullscreenVideo source={sourceUri} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function FullscreenVideo({
  source,
  onClose,
}: {
  source: string;
  onClose: () => void;
}) {
  const player = useVideoPlayer({ uri: source }, (p) => {
    p.play();
  });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <VideoView
          player={player}
          style={{ flex: 1 }}
          nativeControls
          contentFit="contain"
        />
        <CloseOverlayButton onPress={onClose} />
      </View>
    </Modal>
  );
}

/* ----------------------------------- file ---------------------------------- */

function FileBody({
  attachment,
  mine,
}: {
  attachment: MessageAttachment;
  mine: boolean;
}) {
  const { colors } = useTheme();
  const isPdf = attachment.mimeType?.includes("pdf");
  const isArchive = attachment.mimeType?.includes("zip");
  const icon: React.ComponentProps<typeof Ionicons>["name"] = isPdf
    ? "document-text-outline"
    : isArchive
      ? "file-tray-full-outline"
      : "document-outline";
  const opened = attachment.url.startsWith("http");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${attachment.name ?? "le fichier"}`}
      disabled={!opened}
      onPress={() =>
        void Linking.openURL(resolveAttachmentUrl(attachment.url)).catch(
          () => undefined,
        )
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: 2,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: radii.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mine
            ? withAlpha(colors.onPrimary, 0.18)
            : "rgba(255,255,255,0.10)",
        }}
      >
        <Ionicons
          name={icon}
          size={22}
          color={mine ? colors.onPrimary : "#FFFFFF"}
        />
      </View>
      <View style={{ flexShrink: 1 }}>
        <AppText
          numberOfLines={1}
          style={{
            color: mine ? colors.onPrimary : "#FFFFFF",
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {attachment.name ?? "Fichier"}
        </AppText>
        <AppText
          numberOfLines={1}
          style={{
            color: mine
              ? withAlpha(colors.onPrimary, 0.66)
              : "rgba(255,255,255,0.65)",
            fontSize: 12,
          }}
        >
          {attachment.fileSizeBytes
            ? formatFileSize(attachment.fileSizeBytes)
            : "Fichier joint"}
        </AppText>
      </View>
      {opened ? (
        <Ionicons
          name="open-outline"
          size={16}
          color={mine ? "rgba(10,10,10,0.62)" : "rgba(255,255,255,0.65)"}
        />
      ) : null}
    </Pressable>
  );
}

function CloseOverlayButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fermer"
      onPress={onPress}
      style={{
        position: "absolute",
        top: 54,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.14)",
      }}
    >
      <Ionicons name="close" size={24} color="#FFFFFF" />
    </Pressable>
  );
}
