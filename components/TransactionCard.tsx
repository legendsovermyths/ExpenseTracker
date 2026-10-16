import React from "react";
import { StyleSheet, View } from "react-native";
import { SPACE } from "../constants";
import { Transaction } from "../types/entity/Transaction";
import { useExpensifyStore } from "../store/store";
import { useTheme } from "../contexts/ThemeContext";
import { Amount, GlyphPlate, Icon, Text } from "./ui";

// Stable category color, same rule as Analysis/SubcategoryStat.
const colorForId = (id: number, palette: readonly string[]): string =>
  palette[Math.abs(id) % palette.length];

/** One transaction: category glyph · description / account · amount. */
const TransactionCard: React.FC<{ item: Transaction; selected?: boolean }> = ({ item, selected = false }) => {
  const { COLORS } = useTheme();
  const account = useExpensifyStore((state) => state.getAccountById(item.account_id));
  const category = useExpensifyStore((state) => state.getCategoryById(item.subcategory_id || item.category_id));
  const hasFiles = useExpensifyStore((state) => !!state.attachmentOwners[`TRANSACTION:${item.id}`]);

  const plateColor = colorForId(item.subcategory_id || item.category_id || 0, COLORS.ordinal);

  return (
    <View style={styles.row}>
      <GlyphPlate
        name={selected ? "check" : category?.icon_name ?? "help-circle-outline"}
        type={selected ? "material-community" : category?.icon_type ?? "material-community"}
        color={selected ? COLORS.accent : plateColor}
        size={36}
        radius={10}
      />
      <View style={styles.body}>
        <Text variant="headline" numberOfLines={1}>
          {item.description || category?.name || "Untitled"}
        </Text>
        <View style={styles.meta}>
          <Text variant="callout" tone="muted" numberOfLines={1} style={styles.metaText}>
            {account?.name ?? "Account"}
          </Text>
          {hasFiles && <Icon name="paperclip" size={12} color={COLORS.inkSubtle} />}
        </View>
      </View>
      <Amount
        cents={Math.round(item.amount * 100)}
        decimals="never"
        sign={item.is_credit ? "always" : "none"}
        tone={item.is_credit ? "down" : "ink"}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md, minHeight: 60 },
  body: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginTop: 2 },
  metaText: { flexShrink: 1 },
});

export default React.memo(TransactionCard);
