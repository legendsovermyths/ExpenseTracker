import { StyleSheet } from "react-native";
import { ColorPalette } from "../constants/theme";

export const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  input: {
    marginBottom: 15,
    borderRadius: 20,
    backgroundColor: COLORS.white,
  },
});
