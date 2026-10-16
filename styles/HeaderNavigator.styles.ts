import { StyleSheet } from "react-native";
import { ColorPalette } from "../constants/theme";

export const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.paper
  },
  backIcon: {
    width: 30,
    height: 30,
    tintColor:COLORS.ink
  },
  tickIcon: {
    width: 30,
    height: 30,
    tintColor: COLORS.ink
  },
});
