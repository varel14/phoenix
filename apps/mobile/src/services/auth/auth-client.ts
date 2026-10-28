import { createAuthClient } from "better-auth/react";
import { AUTH_BASE_URL } from "@/services/api/api-client";

/**
 * React Native networking keeps cookies in the native cookie store and
 * persists them across app restarts; we only need to make sure credentials
 * are always sent. better-fetch's customFetch hook lets the better-auth
 * client reuse that transport.
 */
async function nativeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((value, key) => headers.set(key, value));
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(url, {
      ...init,
      headers,
      credentials: "include",
      redirect: "manual",
    });
  } catch {
    // Normalize network failures into an HTTP-ish error the client understands.
    return new Response(
      JSON.stringify({
        code: "NETWORK_ERROR",
        message: "Network request failed",
      }),
      {
        status: 0,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  fetchOptions: {
    customFetchImpl: nativeFetch,
  },
  // Mirrors the server's user.additionalFields so the inferred signup body
  // accepts the phone number (WhatsApp-style chat identity).
  user: {
    additionalFields: {
      phone: {
        type: "string" as const,
        required: false,
        input: true,
      },
    },
  },
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;

/** better-auth error codes are English — map the common ones to French copy. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cet e-mail.",
  INVALID_EMAIL: "Adresse e-mail invalide.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou mot de passe incorrect.",
  USER_NOT_FOUND: "E-mail ou mot de passe incorrect.",
  PASSWORD_TOO_SHORT: "Mot de passe trop court — 8 caractères minimum.",
  PASSWORD_TOO_LONG: "Mot de passe trop long.",
  WEAK_PASSWORD: "Mot de passe trop faible — ajoutez chiffres ou symboles.",
  RATE_LIMITED: "Trop de tentatives — réessayez dans un instant.",
};

/**
 * French copy for a better-auth error; falls back to the given French message
 * (never the raw English server text) when the code is unknown.
 */
export function authErrorMessage(
  error: { code?: string | null; message?: string | null } | null | undefined,
  fallback: string,
): string {
  return AUTH_ERROR_MESSAGES[error?.code ?? ""] ?? fallback;
}
