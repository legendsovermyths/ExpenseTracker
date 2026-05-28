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
}

const PieChartWithLegend: React.FC<PieChartWithLegendProps> = ({
  data,
  transactionLength,
  isCategory = 0,
}) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const [selectedSlice, setSelectedSlice] = useState<Partial<PieChartData>>({});

  // Sort by value desc; assign colors from the categorical palette by the
  // entity's id (category or account) so a slice's hue is stable across
  // screens and across time. Falls back to insertion order if no id.
  const dataSorted = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    return sorted.map((d, i) => {
      const entityId = d.category?.id ?? d.account?.id ?? i;
      const idx = Math.abs(entityId) % COLORS.ordinal.length;
      return { ...d, color: COLORS.ordinal[idx] };
    });
  }, [data, COLORS.ordinal]);

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
                    transform: [{ scale: selectedSlice.label === category.label ? 1.3 : 1 }],
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
        radius={150}
        textSize={14}
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
              <Text style={styles.centerText}>txns</Text>
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
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: "600",
  },
  centerText: {
    fontSize: 11,
    color: COLORS.darkgray,
  },
  legendContainer: {
    marginTop: SIZES.base,
    width: "100%",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    width: 140,
  },
  legendItemFirst: {
    marginRight: SIZES.base,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: COLORS.primary,
    fontSize: 12,
    flex: 1,
  },
  legendTextActive: {
    fontWeight: "600",
  },
  legendPercent: {
    color: COLORS.darkgray,
    fontSize: 11,
  },
});

export default PieChartWithLegend;
