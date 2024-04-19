import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { useNavigation } from '@react-navigation/native';
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
  const navigation = useNavigation();
  onPress = () => {
      navigation.navigate('Input');
  };
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress}>
      <Image source={icons.plus} style={styles.fabIcon} />
    </TouchableOpacity>
  );
};

export default CustomFAB