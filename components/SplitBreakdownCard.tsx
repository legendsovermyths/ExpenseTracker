import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { FONTS, SIZES, FONT } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { formatAmountWithCommas } from "../services/Utils";
import { Surface, Avatar, avatarColor } from "./primitives";

export interface SplitPerson {
  id: string;
  name: string;
  paidCents: number;
  oweCents: number;
}

interface Props {
  people: SplitPerson[];
  showBar?: boolean;
}

const fmt = (cents: number) => `₹${formatAmountWithCommas(cents / 100, true)}`;

// Paid / owe table plus a proportional share bar. Shared by the 1:1 split
// summary and the group expense summary so both read the same way.
const SplitBreakdownCard: React.FC<Props> = ({ people, showBar = true }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const totalOwe = people.reduce((s, p) => s + p.oweCents, 0);
  const owing = people.filter((p) => p.oweCents > 0);

  return (
    <Surface tier={2} style={styles.card} padding={0}>
      <View style={[styles.row, styles.head]}>
        <View style={{ flex: 1 }} />
        <Text style={styles.colHead}>PAID</Text>
        <Text style={styles.colHead}>OWE</Text>
      </View>

      {people.map((p, idx) => (
        <View key={p.id}>
          {idx > 0 && <View style={styles.divider} />}
          <View style={styles.row}>
            <Avatar name={p.name} size={32} />
            <Text style={styles.name} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={[styles.value, p.paidCents === 0 && styles.valueZero]}>
              {fmt(p.paidCents)}
            </Text>
            <Text style={[styles.value, p.oweCents === 0 && styles.valueZero]}>
              {fmt(p.oweCents)}
            </Text>
          </View>
        </View>
      ))}

      {showBar && totalOwe > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.barSection}>
            <View style={styles.bar}>
              {owing.map((p) => (
                <View
                  key={p.id}
                  style={{ flex: p.oweCents / totalOwe, backgroundColor: avatarColor(p.name) }}
                />
              ))}
            </View>
            <View style={styles.legend}>
              {owing.map((p) => (
                <View key={p.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: avatarColor(p.name) }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {p.name} {Math.round((p.oweCents / totalOwe) * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </Surface>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    card: { marginBottom: SIZES.base + 4, overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 4,
      gap: SIZES.base + 2,
    },
    head: { paddingBottom: 2, paddingTop: SIZES.base + 2 },
    colHead: {
      ...FONTS.caption,
      color: COLORS.inkSubtle,
      letterSpacing: 1,
      width: 78,
      textAlign: "right",
    },
    name: {
      ...FONTS.bodyM,
      fontFamily: FONT.bold,
      color: COLORS.ink,
      flex: 1,
    },
    value: {
      ...FONTS.amountInline,
      fontSize: 15,
      color: COLORS.ink,
      width: 78,
      textAlign: "right",
    },
    valueZero: { color: COLORS.inkSubtle },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.hairline,
      marginHorizontal: SIZES.padding * 0.7,
    },
    barSection: {
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 4,
    },
    bar: {
      flexDirection: "row",
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
      gap: 2,
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: SIZES.base + 6,
      rowGap: 6,
      marginTop: 10,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { ...FONTS.caption, color: COLORS.inkMuted },
  });

export default SplitBreakdownCard;
