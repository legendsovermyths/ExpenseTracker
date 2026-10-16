import { StyleSheet } from "react-native";
import { ColorPalette } from "../constants/theme";

export const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  input: {
    marginVertical: 10,
    backgroundColor: COLORS.paper,
  },
  datePicker: {
    position: "absolute",
    width: 350,
    backgroundColor: COLORS.paper,
    borderRadius: 20,
    zIndex: 1,
  },
});
