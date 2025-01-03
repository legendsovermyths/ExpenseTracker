import { StyleSheet } from "react-native";
import { COLORS } from "../constants";
export default StyleSheet.create({
  input: {
    marginVertical: 10,
    backgroundColor: COLORS.white,
  },
  datePicker: {
    position: "absolute",
    width: 350,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    zIndex: 1,
  },
});
