import { StyleSheet } from "react-native";
import { ColorPalette } from "../constants/theme";

export const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  input: {
    backgroundColor: COLORS.white,
    marginBottom: 15,
    borderRadius: 20,
  },
});
