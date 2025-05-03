import React, { useState } from "react";
import { FAB, DefaultTheme} from "react-native-paper";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { COLORS, FONTS } from "../constants";

type RootStackParamList = {
  AddCategory: undefined;
  AddBank: undefined;
  AddTransaction: undefined;
  SplitsScreen: undefined;
};

const CustomFAB: React.FC = () => {
  const [open, setOpen] = useState<boolean>(false);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const onStateChange = ({ open }: { open: boolean }) => setOpen(open);

  const fabTheme: any = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: COLORS.primary,
      primaryContainer: COLORS.primary,
      onPrimaryContainer: COLORS.primary,
      elevation: {
        ...((DefaultTheme.colors as any).elevation ?? {}),
        level1: COLORS.white,
        level3: COLORS.lightGray,
      },
    },
  };

  return (
    <FAB.Group
      style={{ position: "absolute", bottom: 16, right: 16 }}
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
          icon: "account-group",
          label: "Splits",
          labelStyle: { color: COLORS.primary, ...FONTS.body3 },
          onPress: () => navigation.navigate("SearchPeople"),
        },
      ]}
      onStateChange={onStateChange}
      onPress={() => {
        /* if you want to do something when FAB is pressed closed, handle here */
      }}
    />
  );
};

export default CustomFAB;
