import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Text } from "react-native-paper";
import { Icon } from "@rneui/themed";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import { useNavigation } from "@react-navigation/native";

export default function AppearanceScreen() {
  const navigation = useNavigation();
  const { COLORS, isDark, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const handleToggle = () => {
    setThemeMode(isDark ? "light" : "dark");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <HeaderNavigator onBackPress={() => navigation.goBack()} />
        <HeaderText text="Appearance" />
        <Text style={styles.description}>Choose how the app looks to you</Text>
      </View>

      <View style={styles.content}>
        {/* Theme Toggle Card */}
        <View style={styles.toggleCard}>
          {/* Sun/Moon Icons with Toggle */}
          <View style={styles.toggleContainer}>
            {/* Light Mode Side */}
            <TouchableOpacity
              style={[styles.modeButton, !isDark && styles.activeModeButton]}
              onPress={() => setThemeMode("light")}
              activeOpacity={0.7}
            >
              <Icon
                name="white-balance-sunny"
                type="material-community"
                size={28}
                color={!isDark ? COLORS.primary : COLORS.darkgray}
              />
              <Text
                style={[styles.modeText, !isDark && styles.activeModeText]}
              >
                Light
              </Text>
            </TouchableOpacity>

            {/* Toggle Switch */}
            <TouchableOpacity
              style={styles.switchContainer}
              onPress={handleToggle}
              activeOpacity={0.8}
            >
              <View style={styles.switchTrack}>
                <View
                  style={[
                    styles.switchThumb,
                    isDark ? styles.switchThumbRight : styles.switchThumbLeft,
                  ]}
                >
                  <Icon
                    name={isDark ? "moon-waning-crescent" : "white-balance-sunny"}
                    type="material-community"
                    size={16}
                    color={COLORS.white}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {/* Dark Mode Side */}
            <TouchableOpacity
              style={[styles.modeButton, isDark && styles.activeModeButton]}
              onPress={() => setThemeMode("dark")}
              activeOpacity={0.7}
            >
              <Icon
                name="moon-waning-crescent"
                type="material-community"
                size={28}
                color={isDark ? COLORS.primary : COLORS.darkgray}
              />
              <Text style={[styles.modeText, isDark && styles.activeModeText]}>
                Dark
              </Text>
            </TouchableOpacity>
          </View>

          {/* Current Mode Indicator */}
          <View style={styles.currentModeContainer}>
            <Text style={styles.currentModeLabel}>Current:</Text>
            <View style={styles.currentModeBadge}>
              <Icon
                name={isDark ? "moon-waning-crescent" : "white-balance-sunny"}
                type="material-community"
                size={14}
                color={COLORS.white}
              />
              <Text style={styles.currentModeValue}>
                {isDark ? "Dark Mode" : "Light Mode"}
              </Text>
            </View>
          </View>
        </View>

        {/* Preview Cards */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={styles.previewCardsContainer}>
            {/* Light Preview */}
            <View
              style={[
                styles.previewCard,
                { backgroundColor: "#FFFFFF" },
                !isDark && styles.previewCardActive,
              ]}
            >
              <View
                style={[styles.previewHeader, { backgroundColor: "#194868" }]}
              />
              <View style={styles.previewContent}>
                <View
                  style={[styles.previewLine, { backgroundColor: "#F5F7F9" }]}
                />
                <View
                  style={[
                    styles.previewLineShort,
                    { backgroundColor: "#F5F7F9" },
                  ]}
                />
              </View>
              <Text style={[styles.previewLabel, { color: "#194868" }]}>
                Light
              </Text>
            </View>

            {/* Dark Preview */}
            <View
              style={[
                styles.previewCard,
                { backgroundColor: "#121212" },
                isDark && styles.previewCardActive,
              ]}
            >
              <View
                style={[styles.previewHeader, { backgroundColor: "#64B5F6" }]}
              />
              <View style={styles.previewContent}>
                <View
                  style={[styles.previewLine, { backgroundColor: "#1E1E1E" }]}
                />
                <View
                  style={[
                    styles.previewLineShort,
                    { backgroundColor: "#1E1E1E" },
                  ]}
                />
              </View>
              <Text style={[styles.previewLabel, { color: "#64B5F6" }]}>
                Dark
              </Text>
            </View>
          </View>
        </View>
      </View>
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
    content: {
      flex: 1,
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding,
    },
    toggleCard: {
      backgroundColor: COLORS.lightGray,
      borderRadius: 20,
      padding: SIZES.padding,
      marginBottom: SIZES.padding,
    },
    toggleContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: SIZES.padding / 2,
    },
    modeButton: {
      alignItems: "center",
      padding: SIZES.padding / 2,
      borderRadius: 12,
      minWidth: 80,
    },
    activeModeButton: {
      backgroundColor: COLORS.white,
    },
    modeText: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      marginTop: 4,
    },
    activeModeText: {
      color: COLORS.primary,
      fontWeight: "600",
    },
    switchContainer: {
      padding: 4,
    },
    switchTrack: {
      width: 56,
      height: 32,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    switchThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: COLORS.white,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3,
    },
    switchThumbLeft: {
      alignSelf: "flex-start",
      backgroundColor: "#FFB74D",
    },
    switchThumbRight: {
      alignSelf: "flex-end",
      backgroundColor: "#5C6BC0",
    },
    currentModeContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: SIZES.padding,
      paddingTop: SIZES.padding,
      borderTopWidth: 1,
      borderTopColor: COLORS.gray,
    },
    currentModeLabel: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      marginRight: SIZES.base,
    },
    currentModeBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    currentModeValue: {
      ...FONTS.body4,
      color: COLORS.white,
      marginLeft: 6,
      fontWeight: "600",
    },
    previewSection: {
      marginTop: SIZES.padding / 2,
    },
    previewTitle: {
      ...FONTS.h3,
      color: COLORS.primary,
      marginBottom: SIZES.padding,
    },
    previewCardsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    previewCard: {
      width: "47%",
      borderRadius: 16,
      padding: 12,
      borderWidth: 2,
      borderColor: "transparent",
    },
    previewCardActive: {
      borderColor: COLORS.primary,
    },
    previewHeader: {
      height: 24,
      borderRadius: 8,
      marginBottom: 12,
    },
    previewContent: {
      gap: 8,
    },
    previewLine: {
      height: 12,
      borderRadius: 6,
    },
    previewLineShort: {
      height: 12,
      borderRadius: 6,
      width: "60%",
    },
    previewLabel: {
      ...FONTS.body4,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 12,
    },
  });
