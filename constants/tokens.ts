import { TextStyle } from "react-native";

// ─────────────────────────────────────────────────────────────────────
// Paper & Ink — design tokens
//
// One typeface (Satoshi), one spacing scale, one radius scale, one set of
// motion timings. Screens and components should reach for these instead of
// raw numbers so the whole app moves in step. Colours live in theme.ts.
// ─────────────────────────────────────────────────────────────────────

// Satoshi ships as static files (no SemiBold). Reference faces by file /
// PostScript name — never combine with `fontWeight`, which makes iOS/Android
// synthesise or substitute a different face.
export const FONT = {
  light: "Satoshi-Light",
  regular: "Satoshi-Regular",
  medium: "Satoshi-Medium",
  bold: "Satoshi-Bold",
  black: "Satoshi-Black",
} as const;

const TABULAR: TextStyle["fontVariant"] = ["tabular-nums"];

export const TYPE = {
  display: { fontFamily: FONT.black, fontSize: 40, lineHeight: 44, letterSpacing: -1.4, fontVariant: TABULAR },
  largeTitle: { fontFamily: FONT.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: FONT.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
  headline: { fontFamily: FONT.medium, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 21 },
  callout: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONT.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: FONT.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: "uppercase" },
  amount: { fontFamily: FONT.bold, fontSize: 16, lineHeight: 22, fontVariant: TABULAR },
  amountLarge: { fontFamily: FONT.black, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, fontVariant: TABULAR },
} satisfies Record<string, TextStyle>;

export type TypeRole = keyof typeof TYPE;

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** Horizontal screen gutter. */
  gutter: 24,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const MOTION = {
  fast: 150,
  base: 200,
  slow: 250,
  /** Press-in scale for tappable surfaces. */
  pressScale: 0.97,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
} as const;

export const ICON = { sm: 16, md: 20, lg: 24 } as const;

/** Minimum comfortable touch target. */
export const HIT = 44;
