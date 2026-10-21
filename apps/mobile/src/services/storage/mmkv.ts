import { createMMKV } from "react-native-mmkv";
import { createJSONStorage } from "zustand/middleware";

/**
 * App-wide local persistence, backed by MMKV (synchronous key-value store on
 * native). Every previously-async AsyncStorage call site goes through
 * `storage`, which keeps the old async signatures — the values just resolve
 * instantly now.
 */
export const mmkv = createMMKV({ id: "phoenix-app" });

/** AsyncStorage-shaped facade over MMKV for drop-in migration. */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    return mmkv.getString(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    mmkv.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    mmkv.remove(key);
  },
};

/** Synchronous adapter for zustand's `createJSONStorage`. */
export const mmkvJsonStorage = createJSONStorage(() => ({
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string): void => mmkv.set(key, value),
  removeItem: (key: string): boolean => mmkv.remove(key),
}));
