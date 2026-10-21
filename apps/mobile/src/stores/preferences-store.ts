import { mmkvJsonStorage } from "@/services/storage/mmkv";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AudioQuality = "AUTO" | "HIGH" | "DATA_SAVER";

interface PreferencesState {
  audioQuality: AudioQuality;
  wifiOnlyDownloads: boolean;
  pushNotifications: boolean;
  setAudioQuality: (quality: AudioQuality) => void;
  setWifiOnlyDownloads: (enabled: boolean) => void;
  setPushNotifications: (enabled: boolean) => void;
}

/** User-facing app preferences, persisted to AsyncStorage. */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      audioQuality: "AUTO",
      wifiOnlyDownloads: true,
      pushNotifications: true,
      setAudioQuality: (audioQuality) => set({ audioQuality }),
      setWifiOnlyDownloads: (wifiOnlyDownloads) => set({ wifiOnlyDownloads }),
      setPushNotifications: (pushNotifications) => set({ pushNotifications }),
    }),
    { name: "phoenix-preferences", storage: mmkvJsonStorage },
  ),
);
