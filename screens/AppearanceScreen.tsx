import React from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ThemeDefinition } from "../constants/theme";
import { Icon, Page, Pressable, SectionLabel, Text } from "../components/ui";

// Miniature app rendered in the theme's own palette, so each tile is an
// honest preview regardless of which theme is currently active.
const ThemePreview = ({ theme }: { theme: ThemeDefinition }) => {
  const c = theme.colors;
  return (
    <View style={[preview.canvas, { backgroundColor: c.paper, borderColor: c.hairline }]}>
      <LinearGradient
        colors={c.heroGradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={preview.hero}
      >
        <View style={[preview.line, { backgroundColor: c.heroInkMuted, width: "40%" }]} />
        <View style={[preview.heroAmount, { backgroundColor: c.heroInk }]} />
        <View style={[preview.line, preview.track, { backgroundColor: c.heroTrack }]}>
          <View style={[preview.fill, { backgroundColor: c.heroInk }]} />
        </View>
      </LinearGradient>
      {[
        { dot: c.ordinal[0], amount: c.deltaUp, width: "45%" as const },
        { dot: c.ordinal[2], amount: c.deltaDown, width: "35%" as const },
      ].map((r, i) => (
        <View key={i} style={[preview.row, { borderTopColor: c.hairline }, i === 0 && preview.firstRow]}>
          <View style={[preview.dot, { backgroundColor: r.dot }]} />
          <View style={[preview.line, { backgroundColor: c.inkSubtle, width: r.width }]} />
          <View style={[preview.rowAmount, { backgroundColor: r.amount }]} />
        </View>
      ))}
      <View style={preview.swatches}>
        {[c.accent, c.accentWarm, c.ordinal[3], c.ordinal[4]].map((color, i) => (
          <View key={i} style={[preview.swatch, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
};

export default function AppearanceScreen() {
  const { COLORS, themes, themeId, setTheme } = useTheme();

  const groups: { title: string; items: ThemeDefinition[] }[] = [
    { title: "Light", items: themes.filter((t) => t.mode === "light") },
    { title: "Dark", items: themes.filter((t) => t.mode === "dark") },
  ];

  return (
    <Page title="Appearance" subtitle="The whole app follows the theme you pick">
      {groups.map((group) => (
        <View key={group.title}>
          <SectionLabel title={group.title} />
          <View style={styles.grid}>
            {group.items.map((t) => {
              const active = t.id === themeId;
              return (
                <Pressable
                  key={t.id}
                  style={styles.tile}
                  onPress={() => setTheme(t.id)}
                  haptic="selection"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${t.name} theme`}
                >
                  <View style={[styles.ring, { borderColor: active ? COLORS.accent : "transparent" }]}>
                    <ThemePreview theme={t} />
                  </View>
                  <View style={styles.caption}>
                    <View style={styles.flex}>
                      <Text variant="headline" numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {t.tagline}
                      </Text>
                    </View>
                    {active && <Icon name="check-circle" size="md" color={COLORS.accent} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Page>
  );
}

const RING = 2;

const preview = StyleSheet.create({
  canvas: {
    borderRadius: RADIUS.md,
    padding: SPACE.sm,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  hero: { borderRadius: RADIUS.sm, padding: SPACE.sm, gap: 5 },
  line: { height: 4, borderRadius: RADIUS.pill },
  heroAmount: { height: 9, width: "60%", borderRadius: RADIUS.pill },
  track: { overflow: "hidden" },
  fill: { height: 4, width: "55%", borderRadius: RADIUS.pill },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  firstRow: { borderTopWidth: 0 },
  dot: { width: 10, height: 10, borderRadius: RADIUS.pill },
  rowAmount: { height: 5, width: 18, borderRadius: RADIUS.pill, marginLeft: "auto" },
  swatches: { flexDirection: "row", gap: SPACE.xs, paddingTop: 2 },
  swatch: { flex: 1, height: 6, borderRadius: RADIUS.pill },
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: SPACE.xl,
  },
  tile: { width: "48%" },
  ring: { borderWidth: RING, borderRadius: RADIUS.md + RING + 2, padding: 2 },
  caption: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingTop: SPACE.sm, paddingHorizontal: SPACE.xs },
  flex: { flex: 1 },
});
