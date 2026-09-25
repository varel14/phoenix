/**
 * Central HTTP client for the Phoenix API. Screens never call fetch
 * directly — everything goes through here (or the auth client, which
 * routes through the same wrapper).
 *
 * Handles: JSON serialization, timeouts, typed errors, auth failures.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export const AUTH_BASE_URL = `${API_URL}/api/v1/auth`;

/**
 * Resolves server-provided media URLs. Relative paths (e.g. "/thumbnails/x.jpg",
 * served by the API's static image library) are resolved against the API root;
 * absolute URLs pass through untouched.
 */
export function resolveAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type UnauthorizedHandler = (error: ApiError) => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** Registered by the auth store to sign the user out on expired sessions. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

async function parseError(response: Response): Promise<ApiError> {
  let code = "REQUEST_FAILED";
  let message = `Request failed (${response.status})`;
  let details: unknown;
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    }
  } catch {
    // non-JSON error body
  }
  return new ApiError(response.status, code, message, details);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** 401 responses are surfaced instead of triggering sign-out. */
  ignoreUnauthorized?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, ignoreUnauthorized } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the Phoenix server. Check your connection.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const apiError = await parseError(response);
    if (apiError.isAuthError && !ignoreUnauthorized) {
      onUnauthorized?.(apiError);
    }
    throw apiError;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getPaginated<T>(path: string, params: object = {}): Promise<Paginated<T>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  const result = await apiFetch<Paginated<T>>(`${path}${qs ? `?${qs}` : ""}`);
  return result;
}
