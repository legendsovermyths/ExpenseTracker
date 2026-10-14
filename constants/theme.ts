import { Dimensions, TextStyle } from "react-native";

const { width, height } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────
// Design tokens
//
// The palette is organized in two layers:
//   1. Semantic tokens — the new system: paper/ink/surface1/surface2,
//      accent, delta colors, ordinal scale. Reach for these in new code.
//   2. Legacy aliases — old names (primary, lightGray, darkgray …) kept
//      as a thin compatibility layer so existing screens don't break.
//      They re-point to the new semantic tokens.
// ─────────────────────────────────────────────────────────────────────

export interface ColorPalette {
  // Semantic — new system
  paper: string;        // screen background
  surface1: string;     // inline content / list rows
  surface2: string;     // elevated card on paper
  hairline: string;     // 1px border
  ink: string;          // primary text
  inkMuted: string;     // secondary text
  inkSubtle: string;    // tertiary text / captions
  accent: string;       // primary cool accent — buttons, active states
  accentWarm: string;   // warm accent — coral, sparingly used
  accentSoft: string;   // accent at low opacity
  deltaUp: string;      // value moved up / over budget (negative for spend)
  deltaDown: string;    // value moved down / under budget (positive for spend)
  neutral: string;      // no delta
  warn: string;         // warning amber

  // Categorical palette for category data viz — assigned by category id
  // (NOT by rank) so a category's color is stable across screens.
  // 8 hues at the same tonal level, curated for finance/expense context.
  ordinal: readonly string[];

  // Legacy aliases — kept for back-compat with existing screens
  primary: string;
  secondary: string;
  black: string;
  white: string;
  lightGray: string;
  lightGray2: string;
  gray: string;
  blue: string;
  darkgray: string;
  yellow: string;
  lightBlue: string;
  darkgreen: string;
  peach: string;
  purple: string;
  red: string;
  red2: string;
}

interface Sizes {
  base: number;
  font: number;
  radius: number;
  padding: number;
  padding2: number;
  largeTitle: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  body1: number;
  body2: number;
  body3: number;
  body4: number;
  c1: number;
  width: number;
  height: number;
}

interface Fonts {
  // New role-based scale
  amountHero: TextStyle;
  amountSection: TextStyle;
  amountCard: TextStyle;
  amountInline: TextStyle;
  screenTitle: TextStyle;
  sectionLabel: TextStyle;
  bodyM: TextStyle;
  bodyS: TextStyle;
  caption: TextStyle;

  // Legacy aliases
  largeTitle: TextStyle;
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  h4: TextStyle;
  c1: TextStyle;
  body1: TextStyle;
  body2: TextStyle;
  body3: TextStyle;
  body4: TextStyle;
  cred: TextStyle;
  credBold: TextStyle;
  credBoldHeading: TextStyle;
}

interface BankCardTheme {
  name: string;
  primary_strip_color: string;
  secondary_strip_color: string;
  card_color: string;
}

// ── Categorical palettes ─────────────────────────────────────────────
// 20 curated hues filling the wheel — chromatic and designed (think
// Copilot Money / Cred). Assigned per category id so a category's color
// is stable across donut, bars, dashboard cards, etc.
//
// First 8 are the "primary" hues; entries 9-20 fill in between so users
// with 15+ categories still get visually distinct colors per slice.
const ORDINAL_LIGHT: readonly string[] = [
  "#3B5CA8", // royal blue
  "#DC6E4B", // coral
  "#3F9D7E", // emerald
  "#8E64B5", // amethyst
  "#DDA938", // honey gold
  "#3FA1C9", // azure
  "#D55E78", // rose
  "#94B247", // chartreuse
  "#6E50A6", // violet
  "#E89077", // salmon
  "#5BAB69", // spring green
  "#B498D4", // lavender
  "#C48E2B", // mustard
  "#2E8B98", // teal
  "#A04060", // berry
  "#6F8639", // olive
  "#6FA8E0", // sky blue
  "#B8553D", // brick
  "#6DBFA0", // mint
  "#6B3F8B", // plum
];

// Dark mode: same hue families, lifted in lightness for contrast on dark.
const ORDINAL_DARK: readonly string[] = [
  "#8DA5DA", // royal blue
  "#EE9579", // coral
  "#7BC4A6", // emerald
  "#B79AD2", // amethyst
  "#EBC774", // honey gold
  "#7CC0DC", // azure
  "#E7889B", // rose
  "#B5C97B", // chartreuse
  "#A48AC8", // violet
  "#F1AE99", // salmon
  "#8FCB94", // spring green
  "#D4BFE4", // lavender
  "#E0B05B", // mustard
  "#6DAEB8", // teal
  "#C57489", // berry
  "#9CB071", // olive
  "#A0C6EC", // sky blue
  "#D88471", // brick
  "#9DD7BD", // mint
  "#9377B0", // plum
];

// ── Light theme — white + royal navy + coral ───────────────────────
export const LIGHT_COLORS: ColorPalette = {
  // Semantic
  paper: "#FFFFFF",
  surface1: "#EEF1F6",
  surface2: "#FFFFFF",
  hairline: "rgba(26,58,110,0.10)",
  ink: "#1A3A6E",
  inkMuted: "#5C6E89",
  inkSubtle: "#94A2BB",
  accent: "#1A3A6E",
  accentWarm: "#E85D5B",
  accentSoft: "rgba(26,58,110,0.10)",
  deltaUp: "#C8392F",
  deltaDown: "#2C7A5C",
  neutral: "#5C6E89",
  warn: "#C99339",

  ordinal: ORDINAL_LIGHT,

  // Legacy aliases (mapped to semantic) — keep every existing screen working.
  primary: "#1A3A6E",        // → ink
  secondary: "#E85D5B",      // → accentWarm (original coral is back)
  black: "#1A3A6E",          // → ink
  white: "#FFFFFF",          // → paper
  lightGray: "#EEF1F6",      // → surface1
  lightGray2: "#FFFFFF",     // → surface2
  gray: "rgba(26,58,110,0.12)",
  blue: "#3781A8",           // info — pulled from categorical sky-teal
  darkgray: "#5C6E89",       // → inkMuted
  yellow: "#C99339",         // → warn
  lightBlue: "#94A2BB",      // → inkSubtle
  darkgreen: "#2C7A5C",      // → deltaDown
  peach: "#E85D5B",          // → accentWarm (coral, restored)
  purple: "#7A5494",         // categorical plum
  red: "#C8392F",            // → deltaUp
  red2: "#C8392F",           // → deltaUp
};

// ── Dark theme — mirrors light tonally with coral warm accent ──────
export const DARK_COLORS: ColorPalette = {
  // Semantic
  paper: "#0B0D10",
  surface1: "#14171C",
  surface2: "#1C2027",
  hairline: "rgba(255,255,255,0.07)",
  ink: "#F1F3F5",
  inkMuted: "#9AA0A8",
  inkSubtle: "#6E747C",
  accent: "#7E9BC9",
  accentWarm: "#F08583",
  accentSoft: "rgba(126,155,201,0.14)",
  deltaUp: "#E07A6F",
  deltaDown: "#6EBC8C",
  neutral: "#9AA0A8",
  warn: "#D9A441",

  ordinal: ORDINAL_DARK,

  // Legacy aliases
  primary: "#F1F3F5",
  secondary: "#F08583",
  black: "#F1F3F5",
  white: "#0B0D10",
  lightGray: "#14171C",
  lightGray2: "#1C2027",
  gray: "#262B33",
  blue: "#7CB7D6",
  darkgray: "#9AA0A8",
  yellow: "#D9A441",
  lightBlue: "#6E747C",
  darkgreen: "#6EBC8C",
  peach: "#F08583",
  purple: "#B391CC",
  red: "#E07A6F",
  red2: "#E07A6F",
};

// Default to light theme for backwards compatibility
export const COLORS: ColorPalette = LIGHT_COLORS;

export const SIZES: Sizes = {
  base: 8,
  font: 14,
  radius: 12,
  padding: 24,
  padding2: 36,
  largeTitle: 50,
  h1: 30,
  h2: 22,
  h3: 16,
  h4: 14,
  body1: 30,
  body2: 20,
  body3: 16,
  body4: 14,
  c1: 21,
  width,
  height,
};

// ── Typography ───────────────────────────────────────────────────────
// Roboto is the single voice. Roboto-Black for amounts and titles,
// Roboto-Bold for inline emphasis, Roboto-Regular for body. Every
// amount style carries tabular numerals so columns of numbers align.

const TABULAR: TextStyle["fontVariant"] = ["tabular-nums"];

export const FONTS: Fonts = {
  // New role-based scale
  amountHero: {
    fontFamily: "Roboto-Black",
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.6,
    fontVariant: TABULAR,
  },
  amountSection: {
    fontFamily: "Roboto-Black",
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
    fontVariant: TABULAR,
  },
  amountCard: {
    fontFamily: "Roboto-Bold",
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    fontVariant: TABULAR,
  },
  amountInline: {
    fontFamily: "Roboto-Bold",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    fontVariant: TABULAR,
  },
  screenTitle: {
    fontFamily: "Roboto-Black",
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  sectionLabel: {
    fontFamily: "Roboto-Bold",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
  },
  bodyM: {
    fontFamily: "Roboto-Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  bodyS: {
    fontFamily: "Roboto-Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: "Roboto-Regular",
    fontSize: 11,
    lineHeight: 14,
  },

  // Legacy
  largeTitle: {
    fontFamily: "Roboto-regular",
    fontSize: SIZES.largeTitle,
    lineHeight: 55,
  },
  h1: { fontFamily: "Roboto-Black", fontSize: SIZES.h1, lineHeight: 36 },
  h2: { fontFamily: "Roboto-Bold", fontSize: SIZES.h2, lineHeight: 30 },
  h3: { fontFamily: "Roboto-Bold", fontSize: SIZES.h3, lineHeight: 22 },
  h4: { fontFamily: "Roboto-Bold", fontSize: SIZES.h4, lineHeight: 22 },
  c1: { fontFamily: "Roboto-Bold", fontSize: SIZES.c1, lineHeight: 25 },
  body1: {
    fontFamily: "Roboto-Regular",
    fontSize: SIZES.body1,
    lineHeight: 36,
  },
  body2: {
    fontFamily: "Roboto-Regular",
    fontSize: SIZES.body2,
    lineHeight: 30,
  },
  body3: {
    fontFamily: "Roboto-Regular",
    fontSize: SIZES.body3,
    lineHeight: 22,
  },
  body4: {
    fontFamily: "Roboto-Regular",
    fontSize: SIZES.body4,
    lineHeight: 22,
  },
  cred: { fontFamily: "CredFont", fontSize: SIZES.body4, lineHeight: 22 },
  credBold: { fontFamily: "CredFont-Bold", fontSize: SIZES.h4, lineHeight: 22 },
  credBoldHeading: {
    fontFamily: "CredFont-Bold",
    fontSize: SIZES.h2,
    lineHeight: 30,
  },
};

// PRETTYCOLORS is kept ONLY for bank card themes and other decorative
// surfaces. Do NOT use it for category/data viz — use COLORS.ordinal.
export const PRETTYCOLORS: readonly string[] = [
  "#424874",
  "#F67280",
  "#7D1C4A",
  "#27445D",
  "#A3D8FF",
  "#97E7E1",
  "#EFBC9B",
  "#E78895",
  "#00A9FF",
  "#BEADFA",
  "#D7C0AE",
  "#3A98B9",
  "#FEBE8C",
  "#7F669D",
  "#FFF38C",
  "#9B7EBD",
  "#732255",
  "#BE3D2A",
  "#169976",
  "#735557",
  "#4F1C51",
  "#3E3F5B",
];

export const BANKCARDTHEMES: readonly BankCardTheme[] = [
  {
    name: "Deep",
    primary_strip_color: "#FF204E",
    secondary_strip_color: "#FF204E",
    card_color: "#00224D",
  },
  {
    name: "Sky",
    primary_strip_color: "#76ABAE",
    secondary_strip_color: "#76ABAE",
    card_color: "#31363F",
  },
  {
    name: "Berry",
    primary_strip_color: "#7077A1",
    secondary_strip_color: "#7077A1",
    card_color: "#2D3250",
  },
  {
    name: "Grass",
    primary_strip_color: "#5C8374",
    secondary_strip_color: "#5C8374",
    card_color: "#092635",
  },
  {
    name: "Carpet",
    primary_strip_color: "#E63E6D",
    secondary_strip_color: "#E63E6D",
    card_color: "#420516",
  },
];

interface AppTheme {
  COLORS: ColorPalette;
  SIZES: Sizes;
  FONTS: Fonts;
  PRETTYCOLORS: readonly string[];
  BANKCARDTHEMES: readonly BankCardTheme[];
}

const appTheme: AppTheme = { COLORS, SIZES, FONTS, PRETTYCOLORS, BANKCARDTHEMES };

export default appTheme;
