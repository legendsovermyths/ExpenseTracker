import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { FONT, RADIUS, SPACE, TYPE } from "../../constants";
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
 * Month calendar shaded by spend: green for quiet days through amber to red
 * for the heaviest. Tap a day to drill in.
 */
const Heatmap: React.FC<HeatmapProps> = ({ year, month, daily, elapsedDays, onSelectDay }) => {
  const { COLORS } = useTheme();
  const currency = useCurrency();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const cell = width > 0 ? (width - GAP * 6) / 7 : 0;
  const max = Math.max(...daily.slice(0, elapsedDays), 1);
  const scale = [
    COLORS.deltaDown + "30",
    COLORS.deltaDown + "55",
    COLORS.warn + "70",
    COLORS.accentWarm + "80",
    COLORS.deltaUp + "A0",
  ];
  const shade = (amount: number, i: number) => {
    if (i >= elapsedDays) return COLORS.surface1;
    if (amount === 0) return scale[0];
    const t = amount / max;
    return t < 0.25 ? scale[1] : t < 0.5 ? scale[2] : t < 0.75 ? scale[3] : scale[4];
  };

  const lead = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...daily.map((_, i) => i)];
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View onLayout={onLayout}>
      {cell > 0 && (
        <>
          <View style={styles.row}>
            {DOW.map((d, i) => (
              <Text key={i} variant="caption" tone="subtle" align="center" style={[styles.dow, { width: cell }]}>
                {d}
              </Text>
            ))}
          </View>
          {rows.map((r, ri) => (
            <View key={ri} style={[styles.row, ri < rows.length - 1 && { marginBottom: GAP }]}>
              {r.map((d, ci) =>
                d === null ? (
                  <View key={ci} style={{ width: cell, height: cell }} />
                ) : (
                  <Pressable
                    key={ci}
                    haptic="selection"
                    disabled={!onSelectDay || d >= elapsedDays}
                    onPress={() => onSelectDay?.(d + 1)}
                    accessibilityLabel={`Day ${d + 1}, ${currency.symbol}${Math.round(daily[d])}`}
                    style={[styles.cell, { width: cell, height: cell, backgroundColor: shade(daily[d], d) }]}
                  >
                    <Text
                      style={[TYPE.caption, styles.dayNum, { color: d >= elapsedDays ? COLORS.inkSubtle : COLORS.ink }]}
                    >
                      {d + 1}
                    </Text>
                  </Pressable>
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
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: GAP },
  dow: { marginBottom: SPACE.xs + 2, fontSize: 10 },
  cell: { borderRadius: RADIUS.sm - 2, alignItems: "center", justifyContent: "center" },
  dayNum: { fontSize: 10, fontFamily: FONT.medium },
  legend: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: SPACE.sm + 2 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});

export default Heatmap;
