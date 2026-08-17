import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { FONTS, SIZES } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { Transaction } from "../types/entity/Transaction";
import { useExpensifyStore } from "../store/store";
import { useTheme } from "../contexts/ThemeContext";
import { GlyphPlate } from "./primitives";

// Stable category color, same rule as Analysis/SubcategoryStat/FeaturedCard.
const colorForId = (id: number, palette: readonly string[]): string =>
  palette[Math.abs(id) % palette.length];

const TransactionCard: React.FC<{ item: Transaction; selected?: boolean }> = ({
  item,
  selected = false,
}) => {
  const { COLORS } = useTheme();
  const account = useExpensifyStore((state) =>
    state.getAccountById(item.account_id),
  );
  const category = useExpensifyStore((state) =>
    state.getCategoryById(item.subcategory_id || item.category_id),
  );
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const colorId = item.subcategory_id || item.category_id || 0;
  const plateColor = colorForId(colorId, COLORS.ordinal);

  return (
    <View key={item.id} style={styles.container}>
      <GlyphPlate
        name={selected ? "check" : category.icon_name}
        type={selected ? "material-community" : category.icon_type}
        color={selected ? COLORS.accent : plateColor}
        size={40}
        radius={11}
      />

      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.bankName}>{account.name}</Text>
      </View>

      <Text
        style={[
          styles.amount,
          { color: item.is_credit ? COLORS.deltaDown : COLORS.ink },
        ]}
      >
        {item.is_credit ? "+" : ""}₹{formatAmountWithCommas(item.amount, false)}
      </Text>
    </View>
  );
};

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SIZES.base + 2,
      paddingHorizontal: 4,
      gap: 12,
    },
    infoContainer: {
      flex: 1,
    },
    title: {
      ...FONTS.bodyM,
      color: COLORS.ink,
      fontFamily: "Roboto-Bold",
      fontSize: 15,
    },
    bankName: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      marginTop: 2,
      letterSpacing: 0.2,
    },
    amount: {
      ...FONTS.amountInline,
      fontSize: 17,
      letterSpacing: -0.3,
    },
  });

export default TransactionCard;
