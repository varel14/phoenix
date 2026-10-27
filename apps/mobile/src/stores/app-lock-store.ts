import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mmkvJsonStorage } from "@/services/storage/mmkv";
import type { UnlockResult } from "@/services/api/app-lock-api";

/**
 * App lock: every 3-day window has its own 6-character code (derived on the
 * server). A device stays unlocked for the rest of the window it unlocked,
 * then blocks itself again until the next code is entered — the current code
 * is read from the API by the owner (curl GET /api/v1/app-lock/code).
 */

/**
 * Escape hatch for development builds — EXPO_PUBLIC_* values are inlined at
 * build time, so distributed release builds always enforce the lock.
 */
const APP_LOCK_DISABLED = process.env.EXPO_PUBLIC_APP_LOCK_DISABLED === "1";

interface AppLockState {
  /** End of the window this device is unlocked for (ISO), null until first unlock. */
  unlockedUntil: string | null;
  windowIndex: number | null;
  unlock: (result: UnlockResult) => void;
}

export const useAppLockStore = create<AppLockState>()(
  persist(
    (set) => ({
      unlockedUntil: null,
      windowIndex: null,
      unlock: ({ windowIndex, endsAt }) =>
        set({ windowIndex, unlockedUntil: endsAt }),
    }),
    { name: "phoenix-app-lock", storage: mmkvJsonStorage },
  ),
);

/**
 * True while the device should be blocked: never unlocked, or the unlocked
 * window has lapsed. Re-evaluated on mount, on foreground and every minute so
 * a device left inside the app is blocked when the window rolls over.
 */
export function useAppLock(): boolean {
  const unlockedUntil = useAppLockStore((state) => state.unlockedUntil);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (APP_LOCK_DISABLED) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    const ticker = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      subscription.remove();
      clearInterval(ticker);
    };
  }, []);

  if (APP_LOCK_DISABLED) return false;
  return !unlockedUntil || Date.parse(unlockedUntil) <= now;
}
