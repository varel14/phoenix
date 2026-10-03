import { File, UploadType } from "expo-file-system";
import Cookies from "@react-native-cookies/cookies";
import { API_URL, ApiError } from "./api-client";

export type UploadKind = "voice" | "audio" | "video" | "image" | "digital";

export interface UploadResult {
  kind: UploadKind;
  url: string | null;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  originalName: string;
}

/**
 * Multipart upload through the native file stack. The session cookie is read
 * from the native cookie store and forwarded explicitly, since the upload
 * does not go through the JS fetch wrapper.
 */
export async function uploadFile(fileUri: string, kind: UploadKind, mimeType: string): Promise<UploadResult> {
  const cookies = await Cookies.get(API_URL);
  const sessionToken = cookies?.["phoenix.session_token"]?.value;

  const file = new File(fileUri);
  const result = await file.upload(`${API_URL}/api/v1/uploads?kind=${kind}`, {
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType,
    headers: sessionToken ? { Cookie: `phoenix.session_token=${sessionToken}` } : {},
  });

  if (result.status < 200 || result.status >= 300) {
    let message = "Envoi du fichier impossible";
    try {
      const body = JSON.parse(result.body) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(result.status, "UPLOAD_ERROR", message);
  }

  const body = JSON.parse(result.body) as { data: UploadResult };
  return body.data;
}

/** Public uploads come back as server-relative paths — make them playable URIs. */
export function absoluteUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
