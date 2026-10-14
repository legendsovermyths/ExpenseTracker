import { StyleSheet } from "react-native";
import { ColorPalette } from "../constants/theme";

export const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  menuStyle: {
    width: 200,
  },
  menuButtonStyle: {
    borderColor: COLORS.primary,
    borderRadius: 30,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 15,
  },
});
