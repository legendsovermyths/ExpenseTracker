import React from "react";
import { StyleSheet, View } from "react-native";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { Amount, Avatar, SectionLabel, Text, avatarColor } from "./ui";

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

const COL = 84;

// Paid / owe table plus a proportional share bar, on paper. Shared by the 1:1
// split summary and the group expense summary so both read the same way.
const SplitBreakdownCard: React.FC<Props> = ({ people, showBar = true }) => {
  const { COLORS } = useTheme();

  const totalOwe = people.reduce((s, p) => s + p.oweCents, 0);
  const owing = people.filter((p) => p.oweCents > 0);

  return (
    <View>
      <SectionLabel
        title="Breakdown"
        right={
          <View style={styles.cols}>
            <Text variant="label" tone="subtle" align="right" style={styles.col}>
              Paid
            </Text>
            <Text variant="label" tone="subtle" align="right" style={styles.col}>
              Owes
            </Text>
          </View>
        }
      />

      {people.map((p, idx) => (
        <View key={p.id} style={[styles.row, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.hairline }]}>
          <Avatar name={p.name} size={32} />
          <Text variant="headline" numberOfLines={1} style={styles.flex}>
            {p.name}
          </Text>
          <Amount cents={p.paidCents} tone={p.paidCents === 0 ? "subtle" : "ink"} style={styles.colAmount} />
          <Amount cents={p.oweCents} tone={p.oweCents === 0 ? "subtle" : "ink"} style={styles.colAmount} />
        </View>
      ))}

      {showBar && totalOwe > 0 && (
        <View style={styles.barSection}>
          <View style={styles.bar}>
            {owing.map((p) => (
              <View key={p.id} style={{ flex: p.oweCents / totalOwe, backgroundColor: avatarColor(p.name) }} />
            ))}
          </View>
          <View style={styles.legend}>
            {owing.map((p) => (
              <View key={p.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: avatarColor(p.name) }]} />
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {p.name} {Math.round((p.oweCents / totalOwe) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md },
  cols: { flexDirection: "row", gap: SPACE.md },
  col: { width: COL },
  colAmount: { width: COL, textAlign: "right" },
  barSection: { paddingTop: SPACE.md, paddingBottom: SPACE.sm },
  bar: { flexDirection: "row", height: 6, borderRadius: RADIUS.pill, overflow: "hidden", gap: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: SPACE.lg, rowGap: SPACE.xs, marginTop: SPACE.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: SPACE.xs + 2, maxWidth: "100%" },
  legendDot: { width: 8, height: 8, borderRadius: RADIUS.pill },
});

export default SplitBreakdownCard;
