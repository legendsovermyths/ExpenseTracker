import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import {
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
const styles = StyleSheet.create({
  fab: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius * 2,
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 30,
    right: 20,
  },
  fabIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
});
const CustomFAB = () => {
  onPress = () => {
    console.log("Pressed");
  };
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress}>
      <Image source={icons.plus} style={styles.fabIcon} />
    </TouchableOpacity>
  );
};

export default CustomFAB