import { Dimensions, TextStyle } from "react-native";

const { width, height } = Dimensions.get("window");

export interface ColorPalette {
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

// Light theme colors
export const LIGHT_COLORS: ColorPalette = {
  primary: "#194868",
  secondary: "#FF615F",
  black: "#1E1F20",
  white: "#FFFFFF",
  lightGray: "#F5F7F9",
  lightGray2: "#FAFBFD",
  gray: "#BEC1D2",
  blue: "#42B0FF",
  darkgray: "#898C95",
  yellow: "#FFD573",
  lightBlue: "#95A9B8",
  darkgreen: "#008159",
  peach: "#FF615F",
  purple: "#8e44ad",
  red: "#FF0000",
  red2: "#BF3131",
};

// Dark theme colors
export const DARK_COLORS: ColorPalette = {
  primary: "#64B5F6",           // Light blue - primary actions and headers
  secondary: "#FF8A80",          // Light coral - accent color
  black: "#E8E8E8",              // Very light gray - primary text (better readability than pure white)
  white: "#121212",              // Very dark gray - main background
  lightGray: "#1E1E1E",          // Dark gray - card backgrounds
  lightGray2: "#2C2C2C",         // Slightly lighter dark gray - elevated surfaces
  gray: "#9E9E9E",               // Medium-light gray - secondary text (better contrast)
  blue: "#42B0FF",               // Bright blue - info/links
  darkgray: "#B0B3C1",           // Light gray - inactive/disabled elements
  yellow: "#FFD54F",             // Slightly muted yellow - warnings/highlights
  lightBlue: "#90CAF9",          // Lighter blue - subtle accents
  darkgreen: "#66BB6A",          // Brighter green - success/credit
  peach: "#FF8A80",              // Light coral - matches secondary
  purple: "#CE93D8",             // Lighter purple - categories
  red: "#EF5350",                // Bright red - errors/debit
  red2: "#E57373",               // Lighter red - secondary errors
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

export const FONTS: Fonts = {
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
