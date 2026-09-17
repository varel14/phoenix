import { create } from "zustand";
import { setUnauthorizedHandler } from "@/services/api/api-client";
import { authClient } from "@/services/auth/auth-client";
import type { SessionUser } from "@/types/api";

interface AuthState {
  user: SessionUser | null;
  isReady: boolean;
  isSigningOut: boolean;
  /** Called once from the root layout on launch. */
  restore: () => Promise<void>;
  /** Forces a session refresh (after sign-in/up or role change). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  handleUnauthorized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isReady: false,
  isSigningOut: false,

  restore: async () => {
    try {
      const { data } = await authClient.getSession();
      set({ user: (data?.user as SessionUser | undefined) ?? null, isReady: true });
    } catch {
      set({ user: null, isReady: true });
    }
  },

  refresh: async () => {
    try {
      const { data } = await authClient.getSession();
      set({ user: (data?.user as SessionUser | undefined) ?? null });
    } catch {
      // keep current state; network errors shouldn't sign the user out
    }
  },

  signOut: async () => {
    set({ isSigningOut: true });
    try {
      await authClient.signOut();
    } catch {
      // clear locally even if the server call fails
    }
    set({ user: null, isSigningOut: false });
  },

  handleUnauthorized: () => {
    // Session expired or revoked server-side.
    set((state) => (state.user === null ? state : { user: null }));
  },
}));

// Central hook: any API 401 signs the user out.
setUnauthorizedHandler(() => {
  useAuthStore.getState().handleUnauthorized();
});
