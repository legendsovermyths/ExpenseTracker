import * as React from "react";
import { FAB, DefaultTheme } from "react-native-paper";
import { COLORS, FONTS, SIZES } from "../constants";
import { useNavigation } from "@react-navigation/native";

const CustomFAB = () => {
  const [state, setState] = React.useState({ open: false });
  const navigation = useNavigation();
  const onStateChange = ({ open }) => setState({ open });

  const { open } = state;
  const fabTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: COLORS.primary,
      primaryContainer: COLORS.primary,
      onPrimaryContainer: COLORS.primary,
      elevation: {
        ...DefaultTheme.colors.elevation,
        level1: COLORS.white,
        level3: COLORS.lightGray,
      },
    },
  };
  return (
    <FAB.Group
      style={{ bottom: 0, position: "absolute" }}
      theme={fabTheme}
      color={COLORS.white}
      open={open}
      visible
      icon={open ? "close" : "plus"}
      actions={[
        {
          icon: "tag",
          label: "Category",
          labelStyle: { color: COLORS.primary, ...FONTS.body3 },
          onPress: () => navigation.navigate("AddCategory"),
        },

        {
          icon: "bank",
          label: "Bank",
          labelStyle: { color: COLORS.primary, ...FONTS.body3 },
          onPress: () => navigation.navigate("AddBank"),
        },
        {
          icon: "cash",
          label: "Transaction",
          labelStyle: { color: COLORS.primary, ...FONTS.body3 },
          onPress: () => navigation.navigate("AddTransaction"),
        },
        {
          icon: "bank-transfer", 
          label: "Transfer",
          labelStyle: { color:COLORS.primary, ...FONTS.body3},
          onPress: () => navigation.navigate("AddTransfer"),
        },
      ]}
      onStateChange={onStateChange}
      onPress={() => {
        if (open) {
          // do something if the speed dial is open
        }
      }}
    />
  );
};

export default CustomFAB;
