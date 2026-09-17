/**
 * Phoenix design tokens — rebrand per mockup: purple→pink gradient brand,
 * dark-mode-first with a full light palette. Colors are exposed through the
 * ThemeProvider/useTheme hook so they respond to the active color scheme;
 * spacing/radii/typography/layout/gradients are scheme-independent.
 */

export interface Palette {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  border: string;

  text: string;
  textMuted: string;
  textFaint: string;

  primary: string;
  primaryDeep: string;
  onPrimary: string;
  /** Tinted surface used for secondary chips, segmented controls, icon tiles. */
  primaryTint: string;

  accent: string;
  gold: string;
  danger: string;
  success: string;
  warning: string;

  favorite: string;
  playerBar: string;
  scrim: string;
  onGradientMuted: string;
}

export const darkColors: Palette = {
  background: "#0A0914",
  surface: "#151225",
  surfaceElevated: "#1E1B33",
  surfaceHighlight: "#2A2647",
  border: "#2A2647",

  text: "#F4F2FF",
  textMuted: "#A29DC0",
  textFaint: "#6B6590",

  primary: "#8E2DE2",
  primaryDeep: "#6A1BC0",
  onPrimary: "#FFFFFF",
  primaryTint: "rgba(142, 45, 226, 0.16)",

  accent: "#FF2E93",
  gold: "#FFC24B",
  danger: "#FF4D67",
  success: "#37D99A",
  warning: "#FFC24B",

  favorite: "#FF2E93",
  playerBar: "#1A1730",
  scrim: "rgba(4, 2, 12, 0.66)",
  onGradientMuted: "rgba(255, 255, 255, 0.85)",
};

export const lightColors: Palette = {
  background: "#F7F5FC",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceHighlight: "#EFEBFA",
  border: "#E7E2F4",

  text: "#1A162E",
  textMuted: "#6E688C",
  textFaint: "#9C96B8",

  primary: "#8E2DE2",
  primaryDeep: "#6A1BC0",
  onPrimary: "#FFFFFF",
  primaryTint: "rgba(142, 45, 226, 0.10)",

  accent: "#FF2E93",
  gold: "#D89A1B",
  danger: "#E5384F",
  success: "#18A874",
  warning: "#D89A1B",

  favorite: "#FF2E93",
  playerBar: "#FFFFFF",
  scrim: "rgba(26, 22, 46, 0.45)",
  onGradientMuted: "rgba(255, 255, 255, 0.9)",
};

/** Brand gradient pairs — the heart of the Phoenix rebrand. */
export const gradients = {
  /** Primary brand: purple → pink. */
  brand: ["#8E2DE2", "#FF2E93"] as const,
  /** Deep variant for full-bleed backgrounds (Now Playing, artist headers). */
  brandDeep: ["#2A1250", "#0A0914"] as const,
  /** Gold accent for Premium/subscription surfaces. */
  premium: ["#FFC24B", "#FF8A3D"] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

/** Typography sizes/weights only — colors come from the active palette. */
export const typography = {
  title: { fontSize: 26, fontWeight: "800" as const },
  heading: { fontSize: 20, fontWeight: "700" as const },
  subheading: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyMuted: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
  small: { fontSize: 11, fontWeight: "600" as const },
} as const;

export type Variant = keyof typeof typography;

/** Default text color per typography variant, resolved against a palette. */
export const variantColor: Record<Variant, keyof Palette> = {
  title: "text",
  heading: "text",
  subheading: "text",
  body: "text",
  bodyMuted: "textMuted",
  caption: "textMuted",
  small: "textFaint",
};

export const layout = {
  screenWidth: "100%" as const,
  artworkLarge: 280,
  artworkRow: 120,
  artworkThumb: 56,
  miniPlayerHeight: 60,
  tabBarHeight: 88,
} as const;
