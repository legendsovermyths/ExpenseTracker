import React, { useState } from "react";
import { FAB } from "react-native-paper";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { FONTS } from "../constants";
import { useTheme } from "../contexts/ThemeContext";

type RootStackParamList = {
  AddCategory: undefined;
  AddBank: undefined;
  AddTransaction: undefined;
  SplitsScreen: undefined;
};

const CustomFAB: React.FC = () => {
  const { COLORS, paperTheme } = useTheme();
  const [open, setOpen] = useState<boolean>(false);
  const navigation: any = useNavigation<NavigationProp<RootStackParamList>>();

  const onStateChange = ({ open }: { open: boolean }) => setOpen(open);

  const fabTheme: any = {
    ...paperTheme,
    colors: {
      ...paperTheme.colors,
      primary: COLORS.ink,
      surface: COLORS.ink,
      surfaceVariant: COLORS.ink,
      primaryContainer: COLORS.ink,
      onPrimaryContainer: COLORS.ink,
      onPrimary: COLORS.ink,
      background: COLORS.paper,
      elevation: {
        level1: COLORS.paper,
        level2: COLORS.paper,
        level3: COLORS.surface1,
      },
    },
  };

  return (
    <FAB.Group
      style={{ position: "absolute", bottom: 0, right: 0 }}
      theme={fabTheme}
      color={COLORS.paper}
      open={open}
      visible
      icon={open ? "close" : "plus"}
      actions={[
        {
          icon: "account-group",
          label: "Splits",
          labelStyle: { color: COLORS.ink, ...FONTS.body3 },
          onPress: () => navigation.navigate("SearchPeople"),
        },
        {
          icon: "account-multiple-plus-outline",
          label: "Group",
          labelStyle: { color: COLORS.ink, ...FONTS.body3 },
          onPress: () => navigation.navigate("CreateGroupScreen"),
        },
        {
          icon: "piggy-bank-outline",
          label: "Fund",
          labelStyle: { color: COLORS.ink, ...FONTS.body3 },
          onPress: () => navigation.navigate("CreateFundScreen"),
        },
        {
          icon: "tag",
          label: "Category",
          labelStyle: { color: COLORS.ink, ...FONTS.body3 },
          onPress: () => navigation.navigate("AddCategory"),
        },
        {
          icon: "bank",
          label: "Bank",
          labelStyle: { color: COLORS.ink, ...FONTS.body3 },
          onPress: () => navigation.navigate("AddBank"),
        },
        {
          icon: "cash",
          label: "Transaction",
          labelStyle: { color: COLORS.ink, ...FONTS.body3 },
          onPress: () => navigation.navigate("AddTransaction"),
        },
      ]}
      onStateChange={onStateChange}
      onPress={() => {
        /* if you want to do something when FAB is pressed closed, handle here */
      }}
      onLongPress={() => {
        navigation.navigate("AddTransaction");
      }}
    />
  );
};

export default CustomFAB;
