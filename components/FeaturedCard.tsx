import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { SIZES, FONTS } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { useExpensifyStore } from "../store/store";
import { TouchableOpacity } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { getMonthRange } from "../services/Utils";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Icon } from "react-native-elements";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - SIZES.padding * 2;

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

  const handleFeaturedCategoryPress = (categoryItem: FeaturedCategoryItem) => {
    const category = categoriesById[categoryItem.key];
    if (!category) return;

    const { firstDate, lastDate } = getMonthRange(categoryItem.year, categoryItem.month);
    navigation.navigate("SubcategoryStat", {
      category: category,
      percentage: 0,
      startDate: firstDate,
      endDate: lastDate,
    });
  };

  switch (item.description) {
    case "Upcoming Expense":
      return (
        <View style={styles.card}>
          <Text style={styles.categoryTitle}>{item.subscriptionTitle}</Text>
          <Text style={styles.categoryDescription}>{item.description}</Text>
          <Text style={styles.categorySpending}>
            Amount{" "}
            <Text style={{ color: COLORS.red2, ...FONTS.h3 }}>
              ₹{item.subscriptionAmount}
            </Text>{" "}
            {`to be paid for ${item.subscriptionTitle} in ${item.daysRemaining} ` +
              (item.daysRemaining > 1 ? "days" : "day")}
            .
          </Text>
        </View>
      );

    case "Featured Category":
      const category = categoriesById[item.key];
      if (!category) return null;

      return (
        <TouchableOpacity onPress={() => handleFeaturedCategoryPress(item)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Icon
                  name={category.icon_name}
                  type={category.icon_type}
                  size={24}
                  color={COLORS.white}
                />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.categoryTitle}>{category.name}</Text>
                <Text style={styles.categoryDescription}>Featured Category</Text>
              </View>
              <View style={styles.transactionBadge}>
                <Text style={styles.transactionCount}>{item.transactions}</Text>
                <Text style={styles.transactionLabel}>txns</Text>
              </View>
            </View>
            <Text style={styles.categorySpending}>
              You have spent{" "}
              <Text style={styles.amountText}>
                ₹{formatAmountWithCommas(item.spent)}
              </Text>{" "}
              on {category.name.toLowerCase()} this month.
            </Text>
            {item.change !== "N/A" && (
              <Text style={styles.categoryComparison}>
                <Text
                  style={[
                    styles.changeText,
                    {
                      color:
                        item.change[0] === "-" ? COLORS.darkgreen : COLORS.red2,
                    },
                  ]}
                >
                  {item.change}
                </Text>{" "}
                vs last month (₹{formatAmountWithCommas(item.lastMonth)})
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );

    default:
      return null;
  }
};

const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.lightGray,
    padding: SIZES.padding,
    borderRadius: 12,
    width: CARD_WIDTH,
    minHeight: 140,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SIZES.padding,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: SIZES.base,
  },
  transactionBadge: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.base,
    paddingVertical: 4,
    borderRadius: 8,
  },
  transactionCount: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  transactionLabel: {
    ...FONTS.body5,
    color: COLORS.darkgray,
    fontSize: 10,
  },
  categoryTitle: {
    color: COLORS.primary,
    ...FONTS.h3,
    fontWeight: "600",
  },
  categoryDescription: {
    color: COLORS.darkgray,
    ...FONTS.body4,
    marginTop: 2,
  },
  categorySpending: {
    marginBottom: SIZES.base / 2,
    color: COLORS.primary,
    ...FONTS.body4,
    lineHeight: 20,
  },
  amountText: {
    color: COLORS.red2,
    ...FONTS.body3,
    fontWeight: "600",
  },
  categoryComparison: {
    color: COLORS.primary,
    ...FONTS.body4,
    lineHeight: 20,
  },
  changeText: {
    ...FONTS.body3,
    fontWeight: "600",
  },
});

export default FeaturedCard;
