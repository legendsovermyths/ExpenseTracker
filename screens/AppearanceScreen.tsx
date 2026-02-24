import React, { useMemo } from "react";
import { View, StyleSheet, FlatList, ListRenderItemInfo } from "react-native";
import { ListItem, Icon } from "@rneui/themed";
import { Text, Switch } from "react-native-paper";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import { useNavigation } from "@react-navigation/native";

type AppearanceOption = {
  id: "system" | "light" | "dark";
  title: string;
  subtitle: string;
  icon: string;
};

const APPEARANCE_OPTIONS: AppearanceOption[] = [
  {
    id: "light",
    title: "Light",
    subtitle: "Always use light theme",
    icon: "white-balance-sunny",
  },
  {
    id: "dark",
    title: "Dark",
    subtitle: "Always use dark theme",
    icon: "moon-waning-crescent",
  },
];

export default function AppearanceScreen() {
  const navigation = useNavigation();
  const { COLORS, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const handleSelect = (option: AppearanceOption) => {
    const shouldBeDark = option.id === "dark";
    if (shouldBeDark !== isDark) {
      toggleTheme();
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<AppearanceOption>) => {
    const isSelected =
      (item.id === "dark" && isDark) || (item.id === "light" && !isDark);

    return (
      <ListItem
        bottomDivider
        containerStyle={[
          styles.listItem,
          isSelected && styles.selectedItem,
        ]}
        onPress={() => handleSelect(item)}
      >
        <Icon
          name={item.icon}
          type="material-community"
          size={24}
          color={isSelected ? COLORS.primary : COLORS.darkgray}
        />
        <ListItem.Content>
          <ListItem.Title
            style={[styles.titleText, isSelected && styles.selectedTitle]}
          >
            {item.title}
          </ListItem.Title>
          <Text style={styles.subtitleText}>{item.subtitle}</Text>
        </ListItem.Content>
        {isSelected && (
          <Icon
            name="check-circle"
            type="material-community"
            size={24}
            color={COLORS.primary}
          />
        )}
      </ListItem>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <HeaderNavigator onBackPress={() => navigation.goBack()} />
        <HeaderText text="Appearance" />
        <Text style={styles.description}>
          Choose how the app looks to you
        </Text>
      </View>
      <FlatList
        data={APPEARANCE_OPTIONS}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.white,
      paddingTop: SIZES.padding,
    },
    header: {
      paddingHorizontal: SIZES.padding,
      paddingTop: (SIZES.padding * 4) / 3,
      paddingBottom: SIZES.base,
      backgroundColor: COLORS.white,
    },
    description: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      marginTop: SIZES.base / 2,
      paddingHorizontal: SIZES.padding / 5,
    },
    list: {
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding,
    },
    listItem: {
      marginVertical: SIZES.base / 2,
      borderRadius: 12,
      backgroundColor: COLORS.white,
    },
    selectedItem: {
      borderWidth: 2,
      borderColor: COLORS.primary,
    },
    titleText: {
      ...FONTS.body3,
      color: COLORS.black,
    },
    selectedTitle: {
      color: COLORS.primary,
      fontWeight: "600",
    },
    subtitleText: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      marginTop: 2,
    },
  });
