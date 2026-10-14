import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from "react-native";

import { SIZES, FONTS } from "../constants";
import { useExpensifyStore } from "../store/store";
import { getMonthRange } from "../services/Utils";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Surface, GlyphPlate } from "./primitives";
import { formatAmountWithCommas } from "../services/Utils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - SIZES.padding * 2;

// Stable category color, same hashing rule as Analysis/SubcategoryStat.
const colorForId = (id: number, palette: readonly string[]): string =>
  palette[Math.abs(id) % palette.length];

interface FeaturedCardItemBase {
  description: string;
}

interface UpcomingExpenseItem extends FeaturedCardItemBase {
  description: "Upcoming Expense";
  subscriptionTitle: string;
  subscriptionAmount: string;
  daysRemaining: number;
}

interface FeaturedCategoryItem extends FeaturedCardItemBase {
  description: "Featured Category";
  key: number;
  spent: number;
  change: string;
  lastMonth: number;
  transactions: number;
  month: number;
  year: number;
}

type FeaturedCardItem = UpcomingExpenseItem | FeaturedCategoryItem;

interface FeaturedCardProps {
  item: FeaturedCardItem;
}

const FeaturedCard: React.FC<FeaturedCardProps> = ({ item }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const navigation = useNavigation<any>();

  if (item.description === "Upcoming Expense") {
    const urgent = item.daysRemaining <= 3;
    const tone = urgent ? COLORS.deltaUp : COLORS.warn;
    return (
      <Surface tier={1} style={styles.card} padding={SIZES.padding}>
        <View style={styles.headerRow}>
          <GlyphPlate
            name="calendar-clock"
            type="material-community"
            color={tone}
            size={40}
            radius={11}
          />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {item.subscriptionTitle}
            </Text>
            <Text style={styles.tagline}>UPCOMING EXPENSE</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: tone + "18" }]}>
            <Text style={[styles.badgeNumber, { color: tone }]}>
              {item.daysRemaining}
            </Text>
            <Text style={[styles.badgeLabel, { color: tone }]}>
              {item.daysRemaining === 1 ? "day" : "days"}
            </Text>
          </View>
        </View>
        <Text style={styles.narrative}>
          You'll pay{" "}
          <Text style={[styles.narrativeAmount, { color: tone }]}>
            ₹{item.subscriptionAmount}
          </Text>{" "}
          for {item.subscriptionTitle}
          {urgent ? " in just" : " in"}{" "}
          <Text style={styles.narrativeBold}>
            {item.daysRemaining} {item.daysRemaining === 1 ? "day" : "days"}
          </Text>
          .
        </Text>
      </Surface>
    );
  }

  if (item.description === "Featured Category") {
    const category = categoriesById[item.key];
    if (!category) return null;

    const color = colorForId(item.key, COLORS.ordinal);
    const hasChange = item.change !== "N/A";
    const isDecrease = hasChange && item.change[0] === "-";
    const deltaTone = isDecrease ? COLORS.deltaDown : COLORS.deltaUp;
    const deltaAbs = hasChange ? item.change.replace("-", "").replace("+", "") : "";
    const diffAmount = formatAmountWithCommas(Math.abs(item.spent - item.lastMonth), false);

    const handlePress = () => {
      const { firstDate, lastDate } = getMonthRange(item.year, item.month);
      navigation.navigate("SubcategoryStat", {
        category,
        percentage: 0,
        startDate: firstDate,
        endDate: lastDate,
      });
    };

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        <Surface tier={1} style={styles.card} padding={SIZES.padding}>
          <View style={styles.headerRow}>
            <GlyphPlate
              name={category.icon_name}
              type={category.icon_type}
              color={color}
              size={40}
              radius={11}
            />
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {category.name}
              </Text>
              <Text style={styles.tagline}>FEATURED CATEGORY</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: color + "18" }]}>
              <Text style={[styles.badgeNumber, { color }]}>
                {item.transactions}
              </Text>
              <Text style={[styles.badgeLabel, { color }]}>
                {item.transactions === 1 ? "txn" : "txns"}
              </Text>
            </View>
          </View>

          <Text style={styles.narrative}>
            You spent{" "}
            <Text style={styles.narrativeAmount}>
              ₹{formatAmountWithCommas(item.spent, false)}
            </Text>{" "}
            on {category.name.toLowerCase()} this month.
          </Text>

          {hasChange && (
            <Text style={styles.narrativeFollow}>
              That's{" "}
              <Text style={[styles.narrativeBold, { color: deltaTone }]}>
                {isDecrease ? "↓" : "↑"} {deltaAbs} (₹{diffAmount})
              </Text>{" "}
              {isDecrease ? "less" : "more"} than last month.
            </Text>
          )}
        </Surface>
      </TouchableOpacity>
    );
  }

  return null;
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      minHeight: 140,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: SIZES.base + 2,
    },
    headerText: {
      flex: 1,
    },
    title: {
      ...FONTS.bodyM,
      color: COLORS.ink,
      fontFamily: "Roboto-Bold",
      fontSize: 17,
    },
    tagline: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      letterSpacing: 1.4,
      marginTop: 2,
      fontSize: 10,
    },
    badge: {
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      minWidth: 44,
    },
    badgeNumber: {
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
      lineHeight: 18,
    },
    badgeLabel: {
      ...FONTS.caption,
      fontSize: 9,
      letterSpacing: 0.4,
      marginTop: 1,
    },

    narrative: {
      ...FONTS.bodyM,
      fontSize: 14,
      lineHeight: 21,
      color: COLORS.ink,
    },
    narrativeFollow: {
      ...FONTS.bodyM,
      fontSize: 14,
      lineHeight: 21,
      color: COLORS.inkMuted,
      marginTop: 4,
    },
    narrativeAmount: {
      fontFamily: "Roboto-Bold",
      color: COLORS.ink,
      fontVariant: ["tabular-nums"],
    },
    narrativeBold: {
      fontFamily: "Roboto-Bold",
      fontVariant: ["tabular-nums"],
    },
  });

export default FeaturedCard;
