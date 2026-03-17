import { StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../constants";

export default StyleSheet.create({
  text: {
    marginLeft: SIZES.padding / 6,
    marginTop: SIZES.padding / 2,
    color: COLORS.primary,
    ...FONTS.h1,
  },
});
