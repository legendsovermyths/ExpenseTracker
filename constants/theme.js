import { Dimensions } from "react-native";
const { width, height } = Dimensions.get("window");

export const COLORS = {
  // base colors
  primary: "#194868", // Dark Blue
  secondary: "#FF615F", // peach

  // colors
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

export const SIZES = {
  // global sizes
  base: 8,
  font: 14,
  radius: 12,
  padding: 24,
  padding2: 36,

  // font sizes
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

  // app dimensions
  width,
  height,
};

export const FONTS = {
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

export const PRETTYCOLORS = [
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
];

export const BANKCARDTHEMES = [
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

const appTheme = { COLORS, SIZES, FONTS, PRETTYCOLORS, BANKCARDTHEMES };

export default appTheme;
