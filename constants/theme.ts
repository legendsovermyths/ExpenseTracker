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

  // Dashboard hero card — a gradient with fixed light-on-color text
  heroGradient: readonly [string, string];
  heroInk: string;
  heroInkMuted: string;
  heroTrack: string;

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
  gray: string;         // solid border / divider
  blue: string;         // info
  darkgray: string;
  yellow: string;
  lightBlue: string;
  darkgreen: string;
  peach: string;
  purple: string;       // categorical accent
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

// ── Theme registry ───────────────────────────────────────────────────
// Every theme is described by its semantic tokens only; the legacy
// aliases are derived in buildPalette() so all themes stay consistent
// and existing screens pick up new themes for free.

export type ThemeId =
  | "light"
  | "dark"
  | "midnight"
  | "aurora"
  | "sakura"
  | "forest"
  | "sunset"
  | "ocean"
  | "mocha"
  | "lavender"
  | "matcha"
  | "arctic"
  | "sand"
  | "nord"
  | "velvet"
  | "ember";

export type ThemeMode = "light" | "dark";

type SemanticTokens = Omit<
  ColorPalette,
  | "ordinal"
  | "primary"
  | "secondary"
  | "black"
  | "white"
  | "lightGray"
  | "lightGray2"
  | "darkgray"
  | "yellow"
  | "lightBlue"
  | "darkgreen"
  | "peach"
  | "red"
  | "red2"
  | "heroInk"
  | "heroInkMuted"
  | "heroTrack"
>;

const buildPalette = (mode: ThemeMode, t: SemanticTokens): ColorPalette => ({
  ...t,
  ordinal: mode === "dark" ? ORDINAL_DARK : ORDINAL_LIGHT,
  heroInk: "#FFFFFF",
  heroInkMuted: mode === "dark" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.65)",
  heroTrack: mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.15)",

  primary: t.ink,
  secondary: t.accentWarm,
  black: t.ink,
  white: t.paper,
  lightGray: t.surface1,
  lightGray2: t.surface2,
  darkgray: t.inkMuted,
  yellow: t.warn,
  lightBlue: t.inkSubtle,
  darkgreen: t.deltaDown,
  peach: t.accentWarm,
  red: t.deltaUp,
  red2: t.deltaUp,
});

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  mode: ThemeMode;
  colors: ColorPalette;
}

// ── Classic — white + royal navy + coral ───────────────────────────
export const LIGHT_COLORS: ColorPalette = buildPalette("light", {
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
  gray: "rgba(26,58,110,0.12)",
  blue: "#3781A8",
  purple: "#7A5494",
  heroGradient: ["#194868", "#0F3252"],
});

// ── Graphite — neutral dark with soft periwinkle ───────────────────
export const DARK_COLORS: ColorPalette = buildPalette("dark", {
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
  gray: "#262B33",
  blue: "#7CB7D6",
  purple: "#B391CC",
  heroGradient: ["#1F2638", "#141A26"],
});

// ── Midnight — true black (OLED) + electric violet ─────────────────
const MIDNIGHT_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#000000",
  surface1: "#0E0B16",
  surface2: "#171321",
  hairline: "rgba(167,139,250,0.10)",
  ink: "#F3F0FF",
  inkMuted: "#A39CBA",
  inkSubtle: "#6C6584",
  accent: "#A78BFA",
  accentWarm: "#F472B6",
  accentSoft: "rgba(167,139,250,0.16)",
  deltaUp: "#FB7185",
  deltaDown: "#5EE0A0",
  neutral: "#A39CBA",
  warn: "#FBBF24",
  gray: "#241E33",
  blue: "#7DD3FC",
  purple: "#C4B5FD",
  heroGradient: ["#4C1D95", "#160B33"],
});

// ── Aurora — deep arctic teal + mint glow ──────────────────────────
const AURORA_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#06181B",
  surface1: "#0C2226",
  surface2: "#122D32",
  hairline: "rgba(94,234,212,0.09)",
  ink: "#E7FBF6",
  inkMuted: "#8FB5AE",
  inkSubtle: "#5C847E",
  accent: "#5EEAD4",
  accentWarm: "#F6A6C8",
  accentSoft: "rgba(94,234,212,0.14)",
  deltaUp: "#F48B94",
  deltaDown: "#6EE7B7",
  neutral: "#8FB5AE",
  warn: "#FCD34D",
  gray: "#1B3A3F",
  blue: "#7DD3FC",
  purple: "#C4B5FD",
  heroGradient: ["#0F766E", "#1E2A5E"],
});

// ── Sakura — blush paper + deep wine ink + rose ────────────────────
const SAKURA_COLORS: ColorPalette = buildPalette("light", {
  paper: "#FFF8F9",
  surface1: "#FBEBEF",
  surface2: "#FFFFFF",
  hairline: "rgba(110,30,66,0.10)",
  ink: "#5B1D3A",
  inkMuted: "#8E6175",
  inkSubtle: "#BC98A8",
  accent: "#C2416F",
  accentWarm: "#E8799B",
  accentSoft: "rgba(194,65,111,0.10)",
  deltaUp: "#C53A4A",
  deltaDown: "#2A7A5E",
  neutral: "#8E6175",
  warn: "#C98A2B",
  gray: "rgba(91,29,58,0.12)",
  blue: "#4C8DB5",
  purple: "#9B5BA5",
  heroGradient: ["#D0547F", "#7A2048"],
});

// ── Forest — pine night + antique gold ─────────────────────────────
const FOREST_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#0B130F",
  surface1: "#111C16",
  surface2: "#17251D",
  hairline: "rgba(214,184,110,0.09)",
  ink: "#EEF3E8",
  inkMuted: "#9CAE9E",
  inkSubtle: "#6A7C6D",
  accent: "#D6B86E",
  accentWarm: "#E3946B",
  accentSoft: "rgba(214,184,110,0.14)",
  deltaUp: "#E07C6C",
  deltaDown: "#8FCB8A",
  neutral: "#9CAE9E",
  warn: "#E2B857",
  gray: "#22322A",
  blue: "#86BFC9",
  purple: "#B9A3D0",
  heroGradient: ["#245C44", "#0E2A1F"],
});

// ── Sunset — warm apricot paper + ember coral ──────────────────────
const SUNSET_COLORS: ColorPalette = buildPalette("light", {
  paper: "#FFF8F2",
  surface1: "#FCEBDD",
  surface2: "#FFFFFF",
  hairline: "rgba(110,46,26,0.10)",
  ink: "#4A2418",
  inkMuted: "#8A5D4C",
  inkSubtle: "#BF9A88",
  accent: "#C24A25",
  accentWarm: "#F08A4B",
  accentSoft: "rgba(194,74,37,0.12)",
  deltaUp: "#C8392F",
  deltaDown: "#2F7D5B",
  neutral: "#8A5D4C",
  warn: "#C9821B",
  gray: "rgba(74,36,24,0.12)",
  blue: "#3C86A6",
  purple: "#8E4F8F",
  heroGradient: ["#D9582C", "#9E2C47"],
});

// ── Ocean — abyssal navy + bioluminescent cyan ─────────────────────
const OCEAN_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#06111E",
  surface1: "#0B1A2B",
  surface2: "#112438",
  hairline: "rgba(103,232,249,0.08)",
  ink: "#E8F4FF",
  inkMuted: "#8DA6BF",
  inkSubtle: "#5C758F",
  accent: "#38BDF8",
  accentWarm: "#FF8A7A",
  accentSoft: "rgba(56,189,248,0.14)",
  deltaUp: "#F7837A",
  deltaDown: "#5EDBA8",
  neutral: "#8DA6BF",
  warn: "#FBBF5A",
  gray: "#1A2F47",
  blue: "#67E8F9",
  purple: "#A5B4FC",
  heroGradient: ["#0B5A9C", "#071C3B"],
});

// ── Mocha — espresso + caramel cream ───────────────────────────────
const MOCHA_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#16100C",
  surface1: "#1F1712",
  surface2: "#291F18",
  hairline: "rgba(232,190,140,0.09)",
  ink: "#F5EBDD",
  inkMuted: "#B8A592",
  inkSubtle: "#84725F",
  accent: "#E3B07A",
  accentWarm: "#E8907A",
  accentSoft: "rgba(227,176,122,0.14)",
  deltaUp: "#E58A78",
  deltaDown: "#A5C98B",
  neutral: "#B8A592",
  warn: "#E8B95A",
  gray: "#35281F",
  blue: "#9CC3D0",
  purple: "#C9A6C9",
  heroGradient: ["#6B4429", "#2A1A10"],
});

// ── Lavender — lilac haze + deep iris ──────────────────────────────
const LAVENDER_COLORS: ColorPalette = buildPalette("light", {
  paper: "#FAF8FF",
  surface1: "#EFEAFB",
  surface2: "#FFFFFF",
  hairline: "rgba(60,40,120,0.10)",
  ink: "#2E2459",
  inkMuted: "#6B6391",
  inkSubtle: "#A49DC2",
  accent: "#6A4FD1",
  accentWarm: "#E77BA8",
  accentSoft: "rgba(106,79,209,0.11)",
  deltaUp: "#C83E5A",
  deltaDown: "#2E8063",
  neutral: "#6B6391",
  warn: "#C48A2A",
  gray: "rgba(46,36,89,0.12)",
  blue: "#4A7FC1",
  purple: "#8B5CC4",
  heroGradient: ["#7B5CE0", "#3A2A8C"],
});

// ── Matcha — sage paper + deep moss ────────────────────────────────
const MATCHA_COLORS: ColorPalette = buildPalette("light", {
  paper: "#F7F9F2",
  surface1: "#E9EFDF",
  surface2: "#FFFFFF",
  hairline: "rgba(40,70,30,0.10)",
  ink: "#23361F",
  inkMuted: "#5F7257",
  inkSubtle: "#9AAA90",
  accent: "#4F7A3A",
  accentWarm: "#D9824F",
  accentSoft: "rgba(79,122,58,0.12)",
  deltaUp: "#C2452F",
  deltaDown: "#2F7D4F",
  neutral: "#5F7257",
  warn: "#B98A25",
  gray: "rgba(35,54,31,0.12)",
  blue: "#3F7F95",
  purple: "#86609A",
  heroGradient: ["#6B9A4C", "#2D4F26"],
});

// ── Arctic — icy white + glacier blue ──────────────────────────────
const ARCTIC_COLORS: ColorPalette = buildPalette("light", {
  paper: "#F6FAFD",
  surface1: "#E5EFF7",
  surface2: "#FFFFFF",
  hairline: "rgba(20,70,110,0.10)",
  ink: "#0E2A40",
  inkMuted: "#4F6A80",
  inkSubtle: "#8FA6B8",
  accent: "#0E7FB8",
  accentWarm: "#F2766B",
  accentSoft: "rgba(14,127,184,0.11)",
  deltaUp: "#CC3F3A",
  deltaDown: "#1F8266",
  neutral: "#4F6A80",
  warn: "#C8901F",
  gray: "rgba(14,42,64,0.12)",
  blue: "#2C95C9",
  purple: "#7464B8",
  heroGradient: ["#2CA3D6", "#0B4F80"],
});

// ── Sand — warm linen + charcoal, quietly minimal ──────────────────
const SAND_COLORS: ColorPalette = buildPalette("light", {
  paper: "#FAF7F2",
  surface1: "#F0EBE2",
  surface2: "#FFFFFF",
  hairline: "rgba(60,50,40,0.10)",
  ink: "#2B2723",
  inkMuted: "#6E665D",
  inkSubtle: "#A8A095",
  accent: "#2B2723",
  accentWarm: "#C8754A",
  accentSoft: "rgba(43,39,35,0.08)",
  deltaUp: "#B8432F",
  deltaDown: "#3F7A55",
  neutral: "#6E665D",
  warn: "#B98A30",
  gray: "rgba(43,39,35,0.12)",
  blue: "#4F7D96",
  purple: "#856487",
  heroGradient: ["#4A433C", "#211D1A"],
});

// ── Nord — polar night + frost blue ────────────────────────────────
const NORD_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#1F232B",
  surface1: "#262B35",
  surface2: "#2E3440",
  hairline: "rgba(216,222,233,0.08)",
  ink: "#ECEFF4",
  inkMuted: "#A3ADBF",
  inkSubtle: "#6F7A8E",
  accent: "#88C0D0",
  accentWarm: "#D08770",
  accentSoft: "rgba(136,192,208,0.14)",
  deltaUp: "#E08A92",
  deltaDown: "#A3BE8C",
  neutral: "#A3ADBF",
  warn: "#EBCB8B",
  gray: "#3B4252",
  blue: "#81A1C1",
  purple: "#B48EAD",
  heroGradient: ["#4C6A8A", "#2E3440"],
});

// ── Velvet — midnight plum + rose gold ─────────────────────────────
const VELVET_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#140A12",
  surface1: "#1D1019",
  surface2: "#271622",
  hairline: "rgba(240,180,170,0.09)",
  ink: "#F8ECEF",
  inkMuted: "#BBA0AA",
  inkSubtle: "#856A75",
  accent: "#F0A99A",
  accentWarm: "#E57FA3",
  accentSoft: "rgba(240,169,154,0.14)",
  deltaUp: "#F2848C",
  deltaDown: "#86D3A8",
  neutral: "#BBA0AA",
  warn: "#F1C26B",
  gray: "#33202D",
  blue: "#92BEE0",
  purple: "#CDA2DA",
  heroGradient: ["#7A2850", "#2A0E22"],
});

// ── Ember — charcoal + molten orange ───────────────────────────────
const EMBER_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#0F0D0C",
  surface1: "#181513",
  surface2: "#211D1A",
  hairline: "rgba(255,160,90,0.09)",
  ink: "#F7F0EA",
  inkMuted: "#ADA197",
  inkSubtle: "#776C63",
  accent: "#FF8A3D",
  accentWarm: "#FFB15C",
  accentSoft: "rgba(255,138,61,0.14)",
  deltaUp: "#F57A6C",
  deltaDown: "#7FD19B",
  neutral: "#ADA197",
  warn: "#F5C04A",
  gray: "#2C2622",
  blue: "#7CB9D9",
  purple: "#C3A0D6",
  heroGradient: ["#C2410C", "#3A1206"],
});

export const THEMES: readonly ThemeDefinition[] = [
  { id: "light", name: "Classic", tagline: "Crisp white & royal navy", mode: "light", colors: LIGHT_COLORS },
  { id: "dark", name: "Graphite", tagline: "Calm, neutral dark", mode: "dark", colors: DARK_COLORS },
  { id: "midnight", name: "Midnight", tagline: "True black & electric violet", mode: "dark", colors: MIDNIGHT_COLORS },
  { id: "aurora", name: "Aurora", tagline: "Arctic teal & mint glow", mode: "dark", colors: AURORA_COLORS },
  { id: "sakura", name: "Sakura", tagline: "Blush petals & deep wine", mode: "light", colors: SAKURA_COLORS },
  { id: "forest", name: "Forest", tagline: "Pine night & antique gold", mode: "dark", colors: FOREST_COLORS },
  { id: "sunset", name: "Sunset", tagline: "Warm apricot & ember", mode: "light", colors: SUNSET_COLORS },
  { id: "ocean", name: "Ocean", tagline: "Deep navy & cyan", mode: "dark", colors: OCEAN_COLORS },
  { id: "mocha", name: "Mocha", tagline: "Espresso & caramel", mode: "dark", colors: MOCHA_COLORS },
  { id: "lavender", name: "Lavender", tagline: "Lilac haze & deep iris", mode: "light", colors: LAVENDER_COLORS },
  { id: "matcha", name: "Matcha", tagline: "Soft sage & moss", mode: "light", colors: MATCHA_COLORS },
  { id: "arctic", name: "Arctic", tagline: "Icy white & glacier blue", mode: "light", colors: ARCTIC_COLORS },
  { id: "sand", name: "Sand", tagline: "Warm linen & charcoal", mode: "light", colors: SAND_COLORS },
  { id: "nord", name: "Nord", tagline: "Polar night & frost", mode: "dark", colors: NORD_COLORS },
  { id: "velvet", name: "Velvet", tagline: "Midnight plum & rose gold", mode: "dark", colors: VELVET_COLORS },
  { id: "ember", name: "Ember", tagline: "Charcoal & molten orange", mode: "dark", colors: EMBER_COLORS },
];

export const DEFAULT_THEME_ID: ThemeId = "light";

export const getThemeById = (id: string | undefined | null): ThemeDefinition =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];

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
