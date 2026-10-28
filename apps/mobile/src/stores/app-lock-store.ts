import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mmkvJsonStorage } from "@/services/storage/mmkv";
import type { UnlockResult } from "@/services/api/app-lock-api";

/**
 * App lock: every 3-day window has its own 6-character code (derived on the
 * server). A device blocks itself when its own 3-day period lapses, then
 * unlocks again on the current code — which the owner reads from the API
 * (curl GET /api/v1/app-lock/code). The code rotation is global; the period
 * is per-device.
 */

/** Length of one unlock period, in ms (3 days). */
export const APP_LOCK_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Escape hatch for development builds — EXPO_PUBLIC_* values are inlined at
 * build time, so distributed release builds always enforce the lock.
 */
const APP_LOCK_DISABLED = process.env.EXPO_PUBLIC_APP_LOCK_DISABLED === "1";

interface AppLockState {
  /** When this device first ran the app (ISO) — its very first period anchor. */
  firstUsedAt: string | null;
  /** End of the current 3-day period (ISO); null only before first launch. */
  unlockedUntil: string | null;
  /** Index of the rotating code last entered, for the record. */
  windowIndex: number | null;
  unlock: (result: UnlockResult) => void;
}

export const useAppLockStore = create<AppLockState>()(
  persist(
    (set) => ({
      firstUsedAt: null,
      unlockedUntil: null,
      windowIndex: null,
      unlock: ({ windowIndex }) =>
        set({
          windowIndex,
          unlockedUntil: new Date(Date.now() + APP_LOCK_PERIOD_MS).toISOString(),
        }),
    }),
    {
      name: "phoenix-app-lock",
      storage: mmkvJsonStorage,
      onRehydrateStorage: () => (state) => {
        // First launch on this device (or first run after updating from a
        // build without firstUsedAt): the 3-day period starts now, so the app
        // is usable right away and only locks when the period lapses.
        if (state?.firstUsedAt == null) {
          const now = Date.now();
          useAppLockStore.setState({
            firstUsedAt: new Date(now).toISOString(),
            unlockedUntil: new Date(now + APP_LOCK_PERIOD_MS).toISOString(),
          });
        }
      },
    },
  ),
);

/**
 * True while the device should be blocked: the 3-day period started at first
 * use (or last unlock) has lapsed. Re-evaluated on mount, on foreground and
 * every minute so a device left inside the app is blocked as soon as the
 * period ends.
 */
export function useAppLock(): boolean {
  const unlockedUntil = useAppLockStore((state) => state.unlockedUntil);
  const [now, setNow] = useState(() => Date.now());
  // Persisted state decides lock vs unlocked — never block on a store that
  // has not finished rehydrating (a fresh install gets initialized to
  // unlocked in onRehydrateStorage above).
  const [hydrated, setHydrated] = useState(useAppLockStore.persist.hasHydrated());

  useEffect(() => useAppLockStore.persist.onFinishHydration(() => setHydrated(true)), []);

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

  if (APP_LOCK_DISABLED || !hydrated) return false;
  return !unlockedUntil || Date.parse(unlockedUntil) <= now;
}
