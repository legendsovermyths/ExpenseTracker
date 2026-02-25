import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { FONTS, SIZES } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { Category } from "../types/entity/Category";
import { Account } from "../types/entity/Account";
import { useTheme } from "../contexts/ThemeContext";

interface PieChartData {
  label: string;
  value: number;
  color: string;
  sum: number;
  category?: Category;
  account?: Account;
  startDate?: string;
  endDate?: string;
}

interface PieChartWithLegendProps {
  data: PieChartData[];
  transactionLength: number;
  isCategory?: number;
  isClickable?: number;
}

const PieChartWithLegend: React.FC<PieChartWithLegendProps> = ({
  data,
  transactionLength,
  isCategory = 0,
  isClickable = 1,
}) => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const [selectedSlice, setSelectedSlice] = useState<Partial<PieChartData>>({});

  const dataSorted = [...data].sort((a, b) => b.value - a.value);

  const handleCategoryClick = (
    label: string,
    value: number,
    entity: Category | Account | undefined,
    startDate?: string,
    endDate?: string
  ) => {
    try {
      if (isCategory && entity) {
        navigation.navigate("SubcategoryStat", {
          category: entity,
          percentage: value,
          startDate: startDate,
          endDate: endDate,
        });
      } else if (entity && 'id' in entity) {
        navigation.navigate("FilteredTransaction", {
          filter: {
            startDate: startDate,
            endDate: endDate,
            accountIds: [entity.id],
            label: label,
          },
        });
      }
    } catch (err) {
      console.error("Navigation error:", err);
    }
  };

  const renderLegendComponent = (categories: PieChartData[]) => {
    const rows = [];
    const columns = 2;
    const categoryRows = Math.ceil(categories.length / columns);

    for (let i = 0; i < categoryRows; i++) {
      const row = categories.slice(i * columns, (i + 1) * columns);
      rows.push(
        <View key={i} style={styles.legendRow}>
          {row.map((category, index) => (
            <TouchableOpacity
              key={index}
              onPress={() =>
                handleCategoryClick(
                  category.label,
                  category.value,
                  isCategory ? category.category : category.account,
                  category.startDate,
                  category.endDate
                )
              }
              style={[styles.legendItem, index === 0 && styles.legendItemFirst]}
            >
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor: category.color,
                    width: selectedSlice.label === category.label ? 10 : 8,
                    height: selectedSlice.label === category.label ? 10 : 8,
                  },
                ]}
              />
              <Text
                style={[
                  styles.legendText,
                  selectedSlice.label === category.label && styles.legendTextActive,
                ]}
                numberOfLines={1}
              >
                {category.label}
              </Text>
              <Text style={styles.legendPercent}>{category.value}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return <View style={styles.legendContainer}>{rows}</View>;
  };

  return (
    <View style={styles.container}>
      <PieChart
        textColor={COLORS.black}
        radius={120}
        textSize={16}
        showTextBackground
        data={dataSorted}
        donut
        innerCircleColor={COLORS.lightGray}
        focusOnPress
        onPress={(slice: PieChartData) => {
          setSelectedSlice(slice);
        }}
        centerLabelComponent={() => {
          return (
            <View style={styles.centerLabel}>
              <Text style={styles.centerNumber}>{transactionLength}</Text>
              <Text style={styles.centerText}>Txns</Text>
            </View>
          );
        }}
      />
      {renderLegendComponent(dataSorted)}
    </View>
  );
};

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    alignItems: "center",
  },
  centerLabel: {
    justifyContent: "center",
    alignItems: "center",
  },
  centerNumber: {
    fontSize: 20,
    color: COLORS.primary,
    ...FONTS.h2,
  },
  centerText: {
    fontSize: 11,
    color: COLORS.darkgray,
    ...FONTS.body5,
  },
  legendContainer: {
    marginTop: SIZES.base,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    width: 130,
  },
  legendItemFirst: {
    marginRight: 16,
  },
  legendDot: {
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    color: COLORS.primary,
    ...FONTS.body5,
    fontSize: 11,
    flex: 1,
  },
  legendTextActive: {
    fontWeight: "600",
  },
  legendPercent: {
    color: COLORS.darkgray,
    ...FONTS.body5,
    fontSize: 10,
  },
});

export default PieChartWithLegend;
