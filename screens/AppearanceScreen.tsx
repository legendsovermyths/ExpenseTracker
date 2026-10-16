import React, { useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Text } from "react-native-paper";
import { Icon } from "@rneui/themed";
import LinearGradient from "react-native-linear-gradient";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette, ThemeDefinition } from "../constants/theme";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import { useNavigation } from "@react-navigation/native";

// Miniature dashboard rendered in the theme's own palette, so each card
// is an honest preview regardless of which theme is currently active.
const ThemePreview = ({ theme }: { theme: ThemeDefinition }) => {
  const c = theme.colors;
  return (
    <View style={[previewStyles.canvas, { backgroundColor: c.paper, borderColor: c.hairline }]}>
      <LinearGradient
        colors={c.heroGradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={previewStyles.hero}
      >
        <View style={[previewStyles.heroLine, { backgroundColor: c.heroInkMuted, width: "40%" }]} />
        <View style={[previewStyles.heroAmount, { backgroundColor: c.heroInk }]} />
        <View style={[previewStyles.heroTrack, { backgroundColor: c.heroTrack }]}>
          <View style={[previewStyles.heroFill, { backgroundColor: c.heroInk }]} />
        </View>
      </LinearGradient>
      <View style={[previewStyles.row, { backgroundColor: c.surface1 }]}>
        <View style={[previewStyles.dot, { backgroundColor: c.ordinal[0] }]} />
        <View style={[previewStyles.rowLine, { backgroundColor: c.inkSubtle }]} />
        <View style={[previewStyles.rowAmount, { backgroundColor: c.deltaUp }]} />
      </View>
      <View style={[previewStyles.row, { backgroundColor: c.surface1 }]}>
        <View style={[previewStyles.dot, { backgroundColor: c.ordinal[2] }]} />
        <View style={[previewStyles.rowLine, { backgroundColor: c.inkSubtle, width: "35%" }]} />
        <View style={[previewStyles.rowAmount, { backgroundColor: c.deltaDown }]} />
      </View>
      <View style={previewStyles.swatches}>
        {[c.accent, c.accentWarm, c.ordinal[3], c.ordinal[4]].map((color, i) => (
          <View key={i} style={[previewStyles.swatch, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
};

export default function AppearanceScreen() {
  const navigation = useNavigation();
  const { COLORS, isDark, themes, themeId, setTheme } = useTheme();
  const styles = useMemo(() => createStyles(COLORS, isDark), [COLORS, isDark]);

  const groups: { title: string; items: ThemeDefinition[] }[] = [
    { title: "LIGHT", items: themes.filter((t) => t.mode === "light") },
    { title: "DARK", items: themes.filter((t) => t.mode === "dark") },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <HeaderNavigator onBackPress={() => navigation.goBack()} />
        <HeaderText text="Appearance" />
        <Text style={styles.description}>Pick a theme — the whole app follows it</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.grid}>
              {group.items.map((t) => {
                const active = t.id === themeId;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.card, active && styles.cardActive]}
                    onPress={() => setTheme(t.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${t.name} theme`}
                  >
                    <ThemePreview theme={t} />
                    <View style={styles.cardFooter}>
                      <View style={styles.cardText}>
                        <Text style={styles.cardName} numberOfLines={1}>{t.name}</Text>
                        <Text style={styles.cardTagline} numberOfLines={1}>{t.tagline}</Text>
                      </View>
                      {active && (
                        <Icon name="check-circle" type="material-community" size={22} color={COLORS.ink} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  canvas: {
    borderRadius: 14,
    padding: 8,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hero: {
    borderRadius: 10,
    padding: 8,
    gap: 5,
  },
  heroLine: { height: 4, borderRadius: 2 },
  heroAmount: { height: 9, width: "60%", borderRadius: 3 },
  heroTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  heroFill: { height: 4, width: "55%", borderRadius: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLine: { height: 4, width: "45%", borderRadius: 2 },
  rowAmount: { height: 5, width: 18, borderRadius: 2, marginLeft: "auto" },
  swatches: { flexDirection: "row", gap: 4, paddingTop: 2 },
  swatch: { flex: 1, height: 6, borderRadius: 3 },
});

const createStyles = (COLORS: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.paper,
      paddingTop: SIZES.padding,
    },
    header: {
      paddingHorizontal: SIZES.padding,
      paddingTop: (SIZES.padding * 4) / 3,
      paddingBottom: SIZES.base,
      backgroundColor: COLORS.paper,
    },
    description: {
      ...FONTS.body4,
      color: COLORS.inkMuted,
      marginTop: SIZES.base / 2,
      paddingHorizontal: SIZES.padding / 5,
    },
    content: {
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.base,
      paddingBottom: SIZES.padding * 2,
    },
    group: {
      marginTop: SIZES.padding,
    },
    groupTitle: {
      ...FONTS.sectionLabel,
      color: COLORS.inkMuted,
      marginBottom: 12,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: SIZES.base * 2,
    },
    card: {
      width: "48%",
      borderRadius: 20,
      padding: 6,
      backgroundColor: COLORS.surface1,
      borderWidth: 2,
      borderColor: isDark ? COLORS.hairline : "transparent",
    },
    cardActive: {
      borderColor: COLORS.ink,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 6,
      paddingTop: 8,
      paddingBottom: 4,
    },
    cardText: {
      flex: 1,
      marginRight: 6,
    },
    cardName: {
      ...FONTS.h4,
      color: COLORS.ink,
    },
    cardTagline: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      marginTop: 2,
    },
  });
