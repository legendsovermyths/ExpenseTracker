import { StyleSheet } from "react-native";
import { ColorPalette } from "../constants/theme";
import { SIZES, FONTS } from "../constants";

export const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  text: {
    marginLeft: SIZES.padding / 6,
    marginTop: SIZES.padding / 2,
    color: COLORS.primary,
    ...FONTS.h1,
  },
});
