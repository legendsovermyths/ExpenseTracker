import { StyleSheet } from "react-native";
import { COLORS } from "../constants";

export default StyleSheet.create({
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
