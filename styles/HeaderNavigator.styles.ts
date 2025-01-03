import { StyleSheet } from "react-native";
import { COLORS } from "../constants";
export default StyleSheet.create({
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
