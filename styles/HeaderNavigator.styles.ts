import { StyleSheet } from "react-native";
import { ColorPalette } from "../constants/theme";

export const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white
  },
  backIcon: {
    width: 30,
    height: 30,
    tintColor:COLORS.primary
  },
  tickIcon: {
    width: 30,
    height: 30,
    tintColor: COLORS.primary
  },
});
