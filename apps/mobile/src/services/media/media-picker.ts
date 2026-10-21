import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { createAudioPlayer } from "expo-audio";
import { uploadFile, absoluteUploadUrl, type UploadKind, type UploadResult } from "@/services/api/uploads-api";

export interface PickedMedia {
  uri: string;
  name: string;
  mimeType: string;
  fileSizeBytes: number | null;
}

async function pickDocument(type: string | string[]): Promise<PickedMedia | null> {
  const result = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.name ?? "fichier",
    mimeType: asset.mimeType ?? "application/octet-stream",
    fileSizeBytes: asset.size ?? null,
  };
}

export function pickAudioFile(): Promise<PickedMedia | null> {
  return pickDocument("audio/*");
}

export function pickVideoFile(): Promise<PickedMedia | null> {
  return pickDocument("video/*");
}

export async function pickImageFile(): Promise<PickedMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    exif: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? "image.jpg",
    mimeType: asset.mimeType ?? "image/jpeg",
    fileSizeBytes: asset.fileSize ?? null,
  };
}

/** Photos straight from the camera (permission requested on first use). */
export async function capturePhoto(): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: false });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileSizeBytes: asset.fileSize ?? null,
  };
}

/** Short chat videos from the library. */
export async function pickChatVideo(): Promise<PickedMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    quality: 0.8,
    exif: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? `video-${Date.now()}.mp4`,
    mimeType: asset.mimeType ?? "video/mp4",
    fileSizeBytes: asset.fileSize ?? null,
  };
}

/** Generic documents (pdf, office, text, zip) for chat FILE messages. */
export function pickChatDocument(): Promise<PickedMedia | null> {
  return pickDocument([
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]);
}

/** Uploads a picked file and returns the public absolute URL + metadata. */
export async function uploadPickedMedia(media: PickedMedia, kind: UploadKind): Promise<UploadResult & { publicUrl: string }> {
  const result = await uploadFile(media.uri, kind, media.mimeType);
  return { ...result, publicUrl: absoluteUploadUrl(result.url) ?? result.storageKey };
}

/**
 * Best-effort duration probe for a picked audio file. Returns null when the
 * platform cannot decode it quickly — duration is optional on songs.
 */
export async function readAudioDuration(uri: string, timeoutMs = 4000): Promise<number | null> {
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  try {
    player = createAudioPlayer({ uri });
    const duration = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      const subscription = player!.addListener("playbackStatusUpdate", (status) => {
        if (status.duration > 0) {
          clearTimeout(timer);
          subscription.remove();
          resolve(status.duration);
        }
      });
    });
    if (duration == null || !Number.isFinite(duration) || duration <= 0) return null;
    return Math.round(duration);
  } catch {
    return null;
  } finally {
    try {
      player?.release();
    } catch {
      // release is best-effort
    }
  }
}
