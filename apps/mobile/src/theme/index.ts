/** Phoenix design tokens — dark, media-first consumer aesthetic. */

export const colors = {
  background: "#0B0B12",
  surface: "#15151F",
  surfaceElevated: "#1D1D2B",
  surfaceHighlight: "#262638",
  border: "#2A2A3C",

  text: "#F5F5FA",
  textMuted: "#9C9CB0",
  textFaint: "#62627A",

  primary: "#8B5CF6",
  primaryPressed: "#7C4DEF",
  onPrimary: "#FFFFFF",

  danger: "#F0455E",
  success: "#3ECF8E",
  warning: "#F5A623",

  favorite: "#F0455E",
  playerBar: "#1D1D2B",
  scrim: "rgba(0, 0, 0, 0.55)",

  artworkFallbackA: "#312E81",
  artworkFallbackB: "#5B21B6",
} as const;

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

export const typography = {
  title: { fontSize: 26, fontWeight: "800" as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: "700" as const, color: colors.text },
  subheading: { fontSize: 16, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.text },
  bodyMuted: { fontSize: 15, fontWeight: "400" as const, color: colors.textMuted },
  caption: { fontSize: 13, fontWeight: "500" as const, color: colors.textMuted },
  small: { fontSize: 11, fontWeight: "600" as const, color: colors.textFaint },
} as const;

export const layout = {
  screenWidth: "100%" as const,
  artworkLarge: 280,
  artworkRow: 120,
  artworkThumb: 56,
  miniPlayerHeight: 60,
  tabBarHeight: 88,
} as const;

export const theme = { colors, spacing, radii, typography, layout };
export default theme;
