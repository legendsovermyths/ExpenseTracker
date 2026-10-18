import { Dimensions, TextStyle } from "react-native";
import { FONT } from "./tokens";

const { width, height } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────
// Design tokens
//
// The palette is organized in two layers:
//   1. Semantic tokens — the new system: paper/ink/surface1/surface2,
//      accent, delta colors, ordinal scale. Reach for these in new code.
//   2. Two extra categorical hues (blue, purple) for charts/badges.
//   Legacy aliases (primary, white, lightGray …) were removed in the
//   Paper & Ink overhaul — use the semantic names.
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

  // Extra categorical hues used by a few charts/badges
  blue: string;
  purple: string;
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
// Each theme is built around one concept (a pigment set, art movement or
// material) and carries its own categorical palette, tuned in OKLCH so all
// hues share the theme's lightness/chroma and lean slightly toward its key
// hue. The first entry is the theme's signature colour. Classic and Graphite
// use the shared ORDINAL_LIGHT / ORDINAL_DARK palettes.

export type ThemeId =
  | "light"
  | "sakura"
  | "terracotta"
  | "iris"
  | "bauhaus"
  | "matcha"
  | "dark"
  | "midnight"
  | "ocean"
  | "aurora"
  | "forest"
  | "mocha"
  | "velvet"
  | "nord";

export type ThemeMode = "light" | "dark";

type SemanticTokens = Omit<ColorPalette, "ordinal" | "heroInk" | "heroInkMuted" | "heroTrack"> & {
  ordinal?: readonly string[];
};

const buildPalette = (mode: ThemeMode, t: SemanticTokens): ColorPalette => ({
  ...t,
  ordinal: t.ordinal ?? (mode === "dark" ? ORDINAL_DARK : ORDINAL_LIGHT),
  heroInk: "#FFFFFF",
  heroInkMuted: mode === "dark" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.65)",
  heroTrack: mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.15)",
});

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  mode: ThemeMode;
  colors: ColorPalette;
}

// ── Classic — white + royal navy + coral ──
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
  blue: "#3781A8",
  purple: "#7A5494",
  heroGradient: ["#194868", "#0F3252"],
});

// ── Sakura — warm washi, sumi ink, beni-red blossom ──
const SAKURA_COLORS: ColorPalette = buildPalette("light", {
  paper: "#FCF8F5",
  surface1: "#F5EBE7",
  surface2: "#FFFFFF",
  hairline: "rgba(60,30,40,0.09)",
  ink: "#2C2024",
  inkMuted: "#76626A",
  inkSubtle: "#B09EA4",
  accent: "#A8355A",
  accentWarm: "#E27D95",
  accentSoft: "rgba(168,53,90,0.10)",
  deltaUp: "#BF3B3B",
  deltaDown: "#3D7A62",
  neutral: "#76626A",
  warn: "#BF8530",
  blue: "#3F6E99",
  purple: "#7F5594",
  heroGradient: ["#D9708F", "#6A2145"],
  ordinal: [
    "#C17084",
    "#7289CC",
    "#589E6B",
    "#C89351",
    "#A478B8",
    "#C3745F",
    "#4695C4",
    "#80974B",
    "#7C6AAF",
    "#DD8E71",
    "#618B4A",
    "#B99AE1",
    "#B67F3F",
    "#0590A2",
    "#A3597B",
    "#998E3B",
    "#73A8E5",
    "#AD5D55",
    "#45BAAF",
    "#8D5891",
  ],
});

// ── Terracotta — Mediterranean clay, saffron, olive grove ──
const TERRACOTTA_COLORS: ColorPalette = buildPalette("light", {
  paper: "#F9F3EB",
  surface1: "#F0E5D8",
  surface2: "#FFFCF8",
  hairline: "rgba(80,40,20,0.10)",
  ink: "#3A2318",
  inkMuted: "#7B5F50",
  inkSubtle: "#AC9585",
  accent: "#A84B26",
  accentWarm: "#D88A35",
  accentSoft: "rgba(168,75,38,0.11)",
  deltaUp: "#B5382B",
  deltaDown: "#5A7838",
  neutral: "#7B5F50",
  warn: "#C2841C",
  blue: "#3D7189",
  purple: "#83506C",
  heroGradient: ["#C9663B", "#6E2A1F"],
  ordinal: [
    "#B97057",
    "#549768",
    "#A471A8",
    "#B7924B",
    "#1E97A5",
    "#BA6C74",
    "#91A158",
    "#7D7EC1",
    "#7F62A0",
    "#D28A68",
    "#5B8548",
    "#BB92D1",
    "#AB7C3C",
    "#168D7D",
    "#9D546D",
    "#8F893C",
    "#7F9DDD",
    "#A45A4B",
    "#65B186",
    "#8B5281",
  ],
});

// ── Irises — ultramarine field, marigold complement ──
const IRIS_COLORS: ColorPalette = buildPalette("light", {
  paper: "#F8F8FC",
  surface1: "#ECECF7",
  surface2: "#FFFFFF",
  hairline: "rgba(30,32,90,0.09)",
  ink: "#1D1E4A",
  inkMuted: "#5D5F8A",
  inkSubtle: "#9D9EBF",
  accent: "#3A3DB0",
  accentWarm: "#E0A02A",
  accentSoft: "rgba(58,61,176,0.10)",
  deltaUp: "#C0403F",
  deltaDown: "#2B7F61",
  neutral: "#5D5F8A",
  warn: "#C4861A",
  blue: "#2C78B8",
  purple: "#7548BB",
  heroGradient: ["#5059D6", "#22196E"],
  ordinal: [
    "#577DD0",
    "#C35D4B",
    "#079676",
    "#9967BC",
    "#BF860D",
    "#058CB9",
    "#C05978",
    "#6CA44B",
    "#6B5BB4",
    "#DE7857",
    "#0A884C",
    "#AA8AE6",
    "#B46E00",
    "#02858C",
    "#9F4376",
    "#768B17",
    "#459FE6",
    "#AC4643",
    "#07B197",
    "#844693",
  ],
});

// ── Bauhaus — cream stock, black type, primary blocks ──
const BAUHAUS_COLORS: ColorPalette = buildPalette("light", {
  paper: "#F4EFE4",
  surface1: "#E9E2D3",
  surface2: "#FBF8F1",
  hairline: "rgba(27,26,23,0.12)",
  ink: "#1B1A17",
  inkMuted: "#5A554E",
  inkSubtle: "#99938A",
  accent: "#1E4AA3",
  accentWarm: "#D8392A",
  accentSoft: "rgba(30,74,163,0.10)",
  deltaUp: "#C3311F",
  deltaDown: "#2A764C",
  neutral: "#5A554E",
  warn: "#D99A12",
  blue: "#2C7AB5",
  purple: "#6A4699",
  heroGradient: ["#2453B3", "#141B33"],
  ordinal: [
    "#4175DA",
    "#C94941",
    "#A98800",
    "#01915F",
    "#9A58C0",
    "#0186AF",
    "#C34676",
    "#3A9024",
    "#644AB7",
    "#E77033",
    "#007F30",
    "#AF83F5",
    "#9F6B03",
    "#087C7F",
    "#9F2868",
    "#797D03",
    "#099FF4",
    "#AC2E20",
    "#01B18E",
    "#802E8D",
  ],
});

// ── Matcha — stoneware paper, moss ink, hojicha warmth ──
const MATCHA_COLORS: ColorPalette = buildPalette("light", {
  paper: "#F6F5EE",
  surface1: "#EAEADF",
  surface2: "#FDFDF9",
  hairline: "rgba(35,45,30,0.10)",
  ink: "#232B1E",
  inkMuted: "#5E6954",
  inkSubtle: "#959E8A",
  accent: "#4A7536",
  accentWarm: "#C2835A",
  accentSoft: "rgba(74,117,54,0.12)",
  deltaUp: "#B4453A",
  deltaDown: "#3A7C4C",
  neutral: "#5E6954",
  warn: "#B08423",
  blue: "#467C8A",
  purple: "#7C6294",
  heroGradient: ["#7C9F57", "#2B4423"],
  ordinal: [
    "#609165",
    "#AC7552",
    "#38929C",
    "#AD9256",
    "#A86E8F",
    "#5888B4",
    "#B16E6F",
    "#909D5F",
    "#5E6BA0",
    "#C68D69",
    "#538255",
    "#999BD6",
    "#9E7D45",
    "#2B8783",
    "#955665",
    "#83894B",
    "#61A5C7",
    "#995D49",
    "#64AC90",
    "#855277",
  ],
});

// ── Graphite — neutral dark with soft periwinkle ──
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
  blue: "#7CB7D6",
  purple: "#B391CC",
  heroGradient: ["#1F2638", "#141A26"],
});

// ── Midnight — OLED black, orchid glow, hot-pink spark ──
const MIDNIGHT_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#000000",
  surface1: "#0D0B12",
  surface2: "#16131E",
  hairline: "rgba(255,255,255,0.07)",
  ink: "#F4F1FA",
  inkMuted: "#A29CB3",
  inkSubtle: "#6B6580",
  accent: "#B89CFF",
  accentWarm: "#FF7AB8",
  accentSoft: "rgba(184,156,255,0.16)",
  deltaUp: "#FF7A8C",
  deltaDown: "#5FE3A8",
  neutral: "#A29CB3",
  warn: "#FFC857",
  blue: "#7CC8FF",
  purple: "#D4BCFF",
  heroGradient: ["#6A3BE4", "#1A0B3F"],
  ordinal: [
    "#CF95F4",
    "#F5B845",
    "#26C0FB",
    "#FC87A4",
    "#9BD976",
    "#8CAFFE",
    "#FF8C72",
    "#20CEA3",
    "#9B8AEE",
    "#FFB79D",
    "#48BB76",
    "#D8C6FE",
    "#EB9E38",
    "#0EBAC5",
    "#D96FA5",
    "#BFB533",
    "#9ED1FE",
    "#E7746A",
    "#38E9C9",
    "#BA72C8",
  ],
});

// ── Ocean — abyssal blue, glowing cyan, coral reef ──
const OCEAN_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#06131F",
  surface1: "#0B1C2B",
  surface2: "#112637",
  hairline: "rgba(160,210,255,0.08)",
  ink: "#E6F1FA",
  inkMuted: "#8DA5BA",
  inkSubtle: "#5A7187",
  accent: "#5CCBE8",
  accentWarm: "#FF9D86",
  accentSoft: "rgba(92,203,232,0.14)",
  deltaUp: "#FF8A80",
  deltaDown: "#5FD6A4",
  neutral: "#8DA5BA",
  warn: "#F7C267",
  blue: "#80B6F0",
  purple: "#A9A6F5",
  heroGradient: ["#0F6CA6", "#07203F"],
  ordinal: [
    "#5DBBE2",
    "#E392B0",
    "#A3D18C",
    "#87AFF1",
    "#E9938E",
    "#61C3A3",
    "#BD9DE4",
    "#D4C16F",
    "#918FD7",
    "#FBB781",
    "#67B280",
    "#D0C4FE",
    "#CBA95B",
    "#3BB5BB",
    "#C17BA8",
    "#A4B86A",
    "#90CFFF",
    "#D17D82",
    "#75DEC4",
    "#A67BBC",
  ],
});

// ── Aurora — polar-night sky, green-to-violet aurora ──
const AURORA_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#090D19",
  surface1: "#101626",
  surface2: "#171F34",
  hairline: "rgba(180,255,220,0.08)",
  ink: "#ECF3F7",
  inkMuted: "#93A1B5",
  inkSubtle: "#5E6B80",
  accent: "#6FE6B6",
  accentWarm: "#FF9EBB",
  accentSoft: "rgba(111,230,182,0.14)",
  deltaUp: "#FF8C9A",
  deltaDown: "#6FE6B6",
  neutral: "#93A1B5",
  warn: "#F8D46D",
  blue: "#79C6FF",
  purple: "#B79DFF",
  heroGradient: ["#0E9B7A", "#3A2690"],
  ordinal: [
    "#5CCDA4",
    "#C8A0F1",
    "#E4C566",
    "#50C3EF",
    "#F293B2",
    "#ABD884",
    "#8AB5FE",
    "#F39B71",
    "#9893E6",
    "#FEBD95",
    "#68BA7D",
    "#D7CCFE",
    "#DBAC53",
    "#1DBEC3",
    "#CF7CAD",
    "#B0BE60",
    "#9FD5FE",
    "#DE8366",
    "#6DE7C7",
    "#B27DC7",
  ],
});

// ── Forest — pine night, gold leaf, lichen ──
const FOREST_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#0B1410",
  surface1: "#111D17",
  surface2: "#18271F",
  hairline: "rgba(230,210,150,0.08)",
  ink: "#EEF2E6",
  inkMuted: "#A0AE9D",
  inkSubtle: "#687A6A",
  accent: "#D9B96C",
  accentWarm: "#E3926B",
  accentSoft: "rgba(217,185,108,0.14)",
  deltaUp: "#E8806E",
  deltaDown: "#94CF8A",
  neutral: "#A0AE9D",
  warn: "#E9BE5C",
  blue: "#8CC2C4",
  purple: "#BBA6D6",
  heroGradient: ["#2F6E4E", "#0D271B"],
  ordinal: [
    "#D8BE7C",
    "#64BDD1",
    "#E19796",
    "#B3CC8C",
    "#7DB4E4",
    "#DE9C7D",
    "#7BC099",
    "#CF99C8",
    "#8196D1",
    "#F7B791",
    "#7CAD7A",
    "#E9BBF2",
    "#CDA86B",
    "#56B4AB",
    "#C57E8C",
    "#AFB470",
    "#86D3F5",
    "#C8856E",
    "#8EDAB8",
    "#B479A1",
  ],
});

// ── Mocha — espresso, caramel, steamed cream ──
const MOCHA_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#15100D",
  surface1: "#1E1713",
  surface2: "#28201A",
  hairline: "rgba(240,200,160,0.08)",
  ink: "#F4EADF",
  inkMuted: "#B6A594",
  inkSubtle: "#7F6F60",
  accent: "#E6B07C",
  accentWarm: "#EA8E6F",
  accentSoft: "rgba(230,176,124,0.14)",
  deltaUp: "#EC8670",
  deltaDown: "#A9CC8C",
  neutral: "#B6A594",
  warn: "#EBBE60",
  blue: "#96C0CF",
  purple: "#C8A5C6",
  heroGradient: ["#8C5B36", "#2A1A10"],
  ordinal: [
    "#DD9C84",
    "#87BE92",
    "#CB9BCA",
    "#DCBC81",
    "#67BEC7",
    "#DE989C",
    "#BBC98A",
    "#A9A6E2",
    "#A78AC1",
    "#F6B798",
    "#87AB75",
    "#E4BDF3",
    "#CFA671",
    "#61B3A2",
    "#C17F91",
    "#B6B171",
    "#B1C6FE",
    "#C78575",
    "#9AD8B1",
    "#B07BA3",
  ],
});

// ── Velvet — bordeaux velvet, rose gold, champagne ──
const VELVET_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#140B10",
  surface1: "#1E1118",
  surface2: "#291822",
  hairline: "rgba(255,200,190,0.08)",
  ink: "#F8EDEF",
  inkMuted: "#BDA3AC",
  inkSubtle: "#866B76",
  accent: "#F2B09F",
  accentWarm: "#FF8FB2",
  accentSoft: "rgba(242,176,159,0.14)",
  deltaUp: "#FF8794",
  deltaDown: "#8AD8AE",
  neutral: "#BDA3AC",
  warn: "#F3C873",
  blue: "#98C1E6",
  purple: "#D3A8E0",
  heroGradient: ["#8E2A58", "#2A0B1E"],
  ordinal: [
    "#E896A7",
    "#E9BC78",
    "#9FACF1",
    "#82C38F",
    "#D09CD6",
    "#E99A84",
    "#73BAEA",
    "#A6BC73",
    "#A38ED1",
    "#FFB79C",
    "#87AF6F",
    "#E0C2FF",
    "#DBA569",
    "#4DB4CC",
    "#C97E9D",
    "#BEB466",
    "#A9CDFF",
    "#D28378",
    "#94DEAF",
    "#B37CB2",
  ],
});

// ── Nord — the Nord palette — polar night, frost, aurora ──
const NORD_COLORS: ColorPalette = buildPalette("dark", {
  paper: "#242933",
  surface1: "#2B303B",
  surface2: "#323846",
  hairline: "rgba(216,222,233,0.08)",
  ink: "#ECEFF4",
  inkMuted: "#AAB3C4",
  inkSubtle: "#76819A",
  accent: "#88C0D0",
  accentWarm: "#D08770",
  accentSoft: "rgba(136,192,208,0.15)",
  deltaUp: "#E08A92",
  deltaDown: "#A3BE8C",
  neutral: "#AAB3C4",
  warn: "#EBCB8B",
  blue: "#81A1C1",
  purple: "#B48EAD",
  heroGradient: ["#5E81AC", "#2E3440"],
  ordinal: [
    "#9AB5E5",
    "#E0A29A",
    "#83C4AC",
    "#C1A8DA",
    "#D7C78F",
    "#80BEDA",
    "#DDA1B2",
    "#B3D3A1",
    "#9A98CB",
    "#FBBDAD",
    "#80B38E",
    "#D8CBFF",
    "#CBB17D",
    "#6BB6BA",
    "#BE89A6",
    "#AFBC85",
    "#A4D4FC",
    "#C98C8B",
    "#99DECB",
    "#A887B4",
  ],
});

export const THEMES: readonly ThemeDefinition[] = [
  { id: "light", name: "Classic", tagline: "Crisp white & royal navy", mode: "light", colors: LIGHT_COLORS },
  { id: "sakura", name: "Sakura", tagline: "Washi paper, sumi ink & blossom", mode: "light", colors: SAKURA_COLORS },
  { id: "terracotta", name: "Terracotta", tagline: "Sun-baked clay, olive & linen", mode: "light", colors: TERRACOTTA_COLORS },
  { id: "iris", name: "Irises", tagline: "Ultramarine & marigold, after Van Gogh", mode: "light", colors: IRIS_COLORS },
  { id: "bauhaus", name: "Bauhaus", tagline: "Primary colour on cream", mode: "light", colors: BAUHAUS_COLORS },
  { id: "matcha", name: "Matcha", tagline: "Stoneware, sage & whisked green", mode: "light", colors: MATCHA_COLORS },
  { id: "dark", name: "Graphite", tagline: "Calm, neutral dark", mode: "dark", colors: DARK_COLORS },
  { id: "midnight", name: "Midnight", tagline: "True black & neon orchid", mode: "dark", colors: MIDNIGHT_COLORS },
  { id: "ocean", name: "Ocean", tagline: "Deep sea & bioluminescence", mode: "dark", colors: OCEAN_COLORS },
  { id: "aurora", name: "Aurora", tagline: "Polar night & northern lights", mode: "dark", colors: AURORA_COLORS },
  { id: "forest", name: "Forest", tagline: "Pine shadow & gilded leaf", mode: "dark", colors: FOREST_COLORS },
  { id: "mocha", name: "Mocha", tagline: "Espresso, caramel & cream", mode: "dark", colors: MOCHA_COLORS },
  { id: "velvet", name: "Velvet", tagline: "Bordeaux velvet & rose gold", mode: "dark", colors: VELVET_COLORS },
  { id: "nord", name: "Nord", tagline: "Polar night & frost", mode: "dark", colors: NORD_COLORS },
];

export const DEFAULT_THEME_ID: ThemeId = "light";

// Retired theme ids → closest current theme, so persisted choices still resolve.
const LEGACY_THEME_ALIASES: Record<string, ThemeId> = {
  sunset: "terracotta",
  sand: "terracotta",
  lavender: "iris",
  arctic: "light",
  ember: "mocha",
};

export const getThemeById = (id: string | undefined | null): ThemeDefinition => {
  const resolved = (id && LEGACY_THEME_ALIASES[id]) || id;
  return THEMES.find((t) => t.id === resolved) ?? THEMES[0];
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
// Satoshi is the single voice (see tokens.ts for the new role scale).
// These legacy role names are kept during the UI migration and all point
// at Satoshi faces. Every amount style carries tabular numerals.

const TABULAR: TextStyle["fontVariant"] = ["tabular-nums"];

export const FONTS: Fonts = {
  // New role-based scale
  amountHero: {
    fontFamily: FONT.black,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.6,
    fontVariant: TABULAR,
  },
  amountSection: {
    fontFamily: FONT.black,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
    fontVariant: TABULAR,
  },
  amountCard: {
    fontFamily: FONT.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    fontVariant: TABULAR,
  },
  amountInline: {
    fontFamily: FONT.bold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    fontVariant: TABULAR,
  },
  screenTitle: {
    fontFamily: FONT.black,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  sectionLabel: {
    fontFamily: FONT.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
  },
  bodyM: {
    fontFamily: FONT.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyS: {
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: FONT.regular,
    fontSize: 11,
    lineHeight: 14,
  },

  // Legacy
  largeTitle: {
    fontFamily: FONT.regular,
    fontSize: SIZES.largeTitle,
    lineHeight: 55,
  },
  h1: { fontFamily: FONT.black, fontSize: SIZES.h1, lineHeight: 36 },
  h2: { fontFamily: FONT.bold, fontSize: SIZES.h2, lineHeight: 30 },
  h3: { fontFamily: FONT.bold, fontSize: SIZES.h3, lineHeight: 22 },
  h4: { fontFamily: FONT.bold, fontSize: SIZES.h4, lineHeight: 22 },
  c1: { fontFamily: FONT.bold, fontSize: SIZES.c1, lineHeight: 25 },
  body1: {
    fontFamily: FONT.regular,
    fontSize: SIZES.body1,
    lineHeight: 36,
  },
  body2: {
    fontFamily: FONT.regular,
    fontSize: SIZES.body2,
    lineHeight: 30,
  },
  body3: {
    fontFamily: FONT.regular,
    fontSize: SIZES.body3,
    lineHeight: 22,
  },
  body4: {
    fontFamily: FONT.regular,
    fontSize: SIZES.body4,
    lineHeight: 22,
  },
  cred: { fontFamily: FONT.medium, fontSize: SIZES.body4, lineHeight: 22 },
  credBold: { fontFamily: FONT.bold, fontSize: SIZES.h4, lineHeight: 22 },
  credBoldHeading: {
    fontFamily: FONT.bold,
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
