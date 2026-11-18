import React from "react";
import { StyleSheet, View } from "react-native";
import { RADIUS, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import { Pressable, Text } from "../ui";

import { useCurrency } from "../../constants/currency";
export interface HeatmapProps {
  year: number;
  /** 0-based month. */
  month: number;
  /** Spend per day (index 0 = 1st), rupees. */
  daily: number[];
  /** Days elapsed (future days render empty). */
  elapsedDays: number;
  onSelectDay?: (day: number) => void;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const GAP = 4;

/**
 * Compact month calendar shaded by spend in one hue (the accent): no-spend
 * days stay neutral, heavier days go darker. Future days are left empty.
 * Tap a day to drill in.
 */
const Heatmap: React.FC<HeatmapProps> = ({ year, month, daily, elapsedDays, onSelectDay }) => {
  const { COLORS } = useTheme();
  const currency = useCurrency();
  const max = Math.max(...daily.slice(0, elapsedDays), 1);
  const scale = [
    COLORS.surface1,
    COLORS.accent + "38",
    COLORS.accent + "73",
    COLORS.accent + "B3",
    COLORS.accent,
  ];
  const shade = (amount: number) => {
    if (amount <= 0) return scale[0];
    const t = amount / max;
    return t < 0.25 ? scale[1] : t < 0.5 ? scale[2] : t < 0.75 ? scale[3] : scale[4];
  };

  const lead = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...daily.map((_, i) => i)];
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7);
    // Weeks that haven't started yet aren't drawn at all.
    if (row.some((d) => d !== null && d < elapsedDays)) rows.push(row);
  }

  return (
    // Cells size with flex (not a measured width) so the grid has its full
    // height on the first frame and content below never jumps.
    <View>
      <View style={styles.row}>
        {DOW.map((d, i) => (
          <Text key={i} variant="caption" tone="subtle" align="center" style={[styles.dow, styles.slot]}>
            {d}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[styles.row, ri < rows.length - 1 && { marginBottom: GAP }]}>
          {r.map((d, ci) =>
            d === null || d >= elapsedDays ? (
              <View key={ci} style={[styles.slot, styles.cell]} />
            ) : (
              <Pressable
                key={ci}
                haptic="selection"
                feedback="none"
                disabled={!onSelectDay}
                onPress={() => onSelectDay?.(d + 1)}
                accessibilityLabel={`Day ${d + 1}, ${currency.symbol}${Math.round(daily[d])}`}
                style={[styles.slot, styles.cell, { backgroundColor: shade(daily[d]) }]}
              />
            ),
          )}
        </View>
      ))}
      <View style={styles.legend}>
        <Text variant="caption" tone="subtle">
          less
        </Text>
        {scale.map((c, i) => (
          <View key={i} style={[styles.swatch, { backgroundColor: c }]} />
        ))}
        <Text variant="caption" tone="subtle">
          more
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: GAP },
  dow: { marginBottom: SPACE.xs },
  slot: { flex: 1 },
  cell: { height: 20, borderRadius: RADIUS.sm / 2 },
  legend: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: SPACE.xs, marginTop: SPACE.sm },
  swatch: { width: 12, height: 8, borderRadius: 2 },
});

export default Heatmap;
