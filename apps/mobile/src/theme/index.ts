/**
 * Chuyassi Emmanuel CE design tokens — 2026 rebrand: brand violet #5B23FF on a
 * deep violet-black canvas, dark-mode-first with a full light palette. Colors
 * are exposed through the ThemeProvider/useTheme hook so they respond to the
 * active color scheme; spacing/radii/typography/layout/gradients are
 * scheme-independent.
 *
 * In dark mode `primary` lifts to a lighter violet (#8F6BFF) so tints stay
 * readable on near-black; the brand core #5B23FF sits in `primaryDeep` and in
 * the light-mode brand gradient. In light mode `primary` is the brand core.
 *
 * Dark palette (2026 refresh): neutral true-black scale — background #0A0A0C,
 * surface #141417, raised #1A1A1E, hairline borders — with violet reserved
 * for the primary and tinted chips, never the base surfaces (reference:
 * pro dashboard dark UIs). The previous palette remains in use for light
 * mode only.
 */

export interface Palette {
  background: string;
  /** A step between background and surface — section washes, subtle zones. */
  backgroundSubtle: string;
  surface: string;
  surfaceElevated: string;
  /** Quieter surface for inputs and recessed wells. */
  surfaceMuted: string;
  surfaceHighlight: string;
  border: string;
  /** Barely-there separator for use inside cards, where `border` is too strong. */
  hairline: string;

  text: string;
  textMuted: string;
  textFaint: string;

  primary: string;
  primaryDeep: string;
  /** Content drawn on top of `primary`/the brand gradient — near-black on lime. */
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
  /** Muted content on deep dark gradients (Now Playing, artist headers). */
  onGradientMuted: string;
}

export const darkColors: Palette = {
  // Neutral true-black scale (reference: product dashboards) — color lives in
  // the violet primary and tinted chips, never in the base surfaces.
  background: "#0A0A0C",
  backgroundSubtle: "#101013",
  surface: "#141417",
  surfaceElevated: "#1A1A1E",
  surfaceMuted: "#0E0E10",
  surfaceHighlight: "#222227",
  border: "#26262B",
  hairline: "rgba(240, 240, 245, 0.08)",

  text: "#F2F2F5",
  textMuted: "#A0A0A8",
  textFaint: "#6C6C74",

  primary: "#7E5FFF",
  primaryDeep: "#7655F4",
  onPrimary: "#0E0D15",
  primaryTint: "rgba(126, 95, 255, 0.14)",

  accent: "#7E5FFF",
  gold: "#F0BB3B",
  danger: "#FF847D",
  success: "#6BC670",
  warning: "#F0BB3B",

  favorite: "#FF4D6D",
  playerBar: "rgba(18, 18, 22, 0.92)",
  scrim: "rgba(8, 8, 10, 0.66)",
  onGradientMuted: "rgba(255, 255, 255, 0.85)",
};

export const lightColors: Palette = {
  background: "#F6F5FB",
  backgroundSubtle: "#EFEEF6",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#FFFFFF",
  surfaceHighlight: "#ECEAF6",
  border: "#E2DFEF",
  hairline: "rgba(28, 20, 64, 0.08)",

  text: "#171330",
  textMuted: "#5E5980",
  textFaint: "#948FAE",

  primary: "#5B23FF",
  primaryDeep: "#4517C9",
  onPrimary: "#FFFFFF",
  primaryTint: "rgba(91, 35, 255, 0.10)",

  accent: "#5B23FF",
  gold: "#D89A1B",
  danger: "#E5384F",
  success: "#18A874",
  warning: "#D89A1B",

  favorite: "#FF4D6D",
  playerBar: "rgba(255, 255, 255, 0.95)",
  scrim: "rgba(23, 19, 48, 0.45)",
  onGradientMuted: "rgba(255, 255, 255, 0.9)",
};

/**
 * Brand gradient pairs — the heart of the brand. The primary gradient is
 * scheme-aware: lighter violets in dark mode so the near-black on-primary
 * foreground keeps its contrast; the original deep violet in light mode.
 */
export const lightGradients = {
  /** Primary brand: violet, anchored on #5B23FF. */
  brand: ["#8B5CF6", "#5B23FF"] as const,
  /** Deep violet variant for full-bleed backgrounds (Now Playing, artist headers). */
  brandDeep: ["#231255", "#0A0914"] as const,
  /** Gold accent for Premium/subscription surfaces. */
  premium: ["#FFC24B", "#FF8A3D"] as const,
};

export const darkGradients = {
  brand: ["#8B78FF", "#7655F4"] as const,
  brandDeep: ["#22114F", "#0A0A0C"] as const,
  premium: ["#FFC24B", "#FF8A3D"] as const,
};

export type ThemeGradients = {
  brand: readonly [string, string];
  brandDeep: readonly [string, string];
  premium: readonly [string, string];
};

/**
 * Ambient color washes for immersive player surfaces, keyed by mood. The top
 * color melts into the violet-black canvas — pair with `pickAmbient(seed)`.
 */
export const ambientGradients = {
  violet: ["#3B1E70", "#0A0914"] as const,
  rose: ["#701E3E", "#0A0914"] as const,
  amber: ["#6B4A12", "#0A0914"] as const,
  teal: ["#0E4F4A", "#0A0914"] as const,
  indigo: ["#1E3A8A", "#0A0914"] as const,
  grape: ["#4C1D95", "#0A0914"] as const,
};

export type AmbientKey = keyof typeof ambientGradients;

/** Deterministic ambient mood for a media id, so artwork always gets the same wash. */
export function pickAmbient(seed: string): AmbientKey {
  const keys = Object.keys(ambientGradients) as AmbientKey[];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return keys[Math.abs(hash) % keys.length];
}

/** Layered, scheme-aware depth presets (RN new-arch `boxShadow`). */
const shadowSets = {
  dark: {
    card: "0 1px 2px rgba(0, 0, 0, 0.36), 0 10px 30px rgba(0, 0, 0, 0.36)",
    float: "0 16px 44px rgba(0, 0, 0, 0.6)",
    bubble: "0 2px 10px rgba(0, 0, 0, 0.3)",
  },
  light: {
    card: "0 1px 2px rgba(28, 20, 64, 0.05), 0 10px 30px rgba(28, 20, 64, 0.07)",
    float: "0 16px 44px rgba(28, 20, 64, 0.18)",
    bubble: "0 2px 10px rgba(28, 20, 64, 0.07)",
  },
} as const;

export type Shadows = (typeof shadowSets)[keyof typeof shadowSets];
export const shadows = shadowSets;

/** Colored glows under brand-gradient elements; identical in both schemes. */
export const glows = {
  brand: "0 8px 24px rgba(118, 85, 244, 0.32)",
  accent: "0 8px 24px rgba(139, 120, 255, 0.28)",
  gold: "0 8px 24px rgba(216, 154, 27, 0.28)",
} as const;

/** `#RRGGBB` → `rgba(r, g, b, alpha)` for tinted fills derived from palette colors. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  xl: 24,
  full: 999,
} as const;

/** Typography sizes/weights only — colors come from the active palette. */
export const typography = {
  title: {
    fontSize: 26,
    fontWeight: "800" as const,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700" as const,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyMuted: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "500" as const, lineHeight: 18 },
  small: { fontSize: 11, fontWeight: "600" as const, lineHeight: 14 },
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
  tabBarHeight: 64,
} as const;
