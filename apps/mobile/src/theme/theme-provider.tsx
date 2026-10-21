import { mmkvJsonStorage } from "@/services/storage/mmkv";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  ambientGradients,
  darkColors,
  darkGradients,
  glows,
  layout,
  lightColors,
  lightGradients,
  radii,
  shadows,
  spacing,
  typography,
  type Palette,
  type Shadows,
  type ThemeGradients,
} from "./index";

export type ThemeMode = "system" | "dark" | "light";

interface ThemeModeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeModeStore = create<ThemeModeState>()(
  persist(
    (set) => ({
      mode: "system",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "phoenix-theme-mode",
      storage: mmkvJsonStorage,
    },
  ),
);

export interface Theme {
  colors: Palette;
  gradients: ThemeGradients;
  ambient: typeof ambientGradients;
  shadows: Shadows;
  glows: typeof glows;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  layout: typeof layout;
  isDark: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

/** Dark-first theme provider; mode defaults to the OS scheme with manual override. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeModeStore((state) => state.mode);
  const systemScheme = useColorScheme();
  const isDark = mode === "system" ? systemScheme !== "light" : mode === "dark";

  const theme = useMemo<Theme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      gradients: isDark ? darkGradients : lightGradients,
      ambient: ambientGradients,
      shadows: isDark ? shadows.dark : shadows.light,
      glows,
      spacing,
      radii,
      typography,
      layout,
      isDark,
    }),
    [isDark],
  );

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside <ThemeProvider>");
  return theme;
}
