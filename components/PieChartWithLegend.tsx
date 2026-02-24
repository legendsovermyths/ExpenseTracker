import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { FONTS } from "../constants";
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
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();
  const [selectedSlice, setSelectedSlice] = useState<Partial<PieChartData>>({});

  const dataSorted = [...data].sort((a, b) => b.value - a.value);

  const renderDot = (color: string, label: string) => {
    return (
      <View
        style={{
          height: label === selectedSlice.label ? 12 : 10,
          width: label === selectedSlice.label ? 12 : 10,
          borderRadius: 5,
          backgroundColor: color,
          marginRight: 10,
        }}
      />
    );
  };

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
        <View
          key={i}
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginBottom: 10,
          }}
        >
          {row.map((category, index) =>
            isCategory === 0 ? (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  handleCategoryClick(
                    category.label,
                    category.value,
                    category.account,
                    category.startDate,
                    category.endDate
                  );
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    width: 130,
                    marginRight: index === 0 ? 20 : 0,
                  }}
                >
                  {renderDot(category.color, category.label)}
                  <Text
                    style={{
                      color: COLORS.primary,
                      ...(selectedSlice.label === category.label
                        ? FONTS.h4
                        : FONTS.body4),
                    }}
                  >
                    {category.label}: {category.value}%
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                key={index}
                onPress={() =>
                  handleCategoryClick(
                    category.label,
                    category.value,
                    category.category,
                    category.startDate,
                    category.endDate
                  )
                }
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    width: 130,
                    marginRight: index === 0 ? 20 : 0,
                  }}
                >
                  {renderDot(category.color, category.label)}
                  <Text
                    style={{
                      color: COLORS.primary,
                      ...(selectedSlice.label === category.label
                        ? FONTS.h4
                        : FONTS.body4),
                    }}
                  >
                    {category.label}: {category.value}%
                  </Text>
                </View>
              </TouchableOpacity>
            )
          )}
        </View>
      );
    }

    return <View>{rows}</View>;
  };

  return (
    <View>
      <PieChart
        textColor="black"
        radius={150}
        textSize={20}
        showTextBackground
        data={dataSorted}
        donut
        focusOnPress
        onPress={(slice: PieChartData) => {
          setSelectedSlice(slice);
        }}
        centerLabelComponent={() => {
          return (
            <View style={{ justifyContent: "center", alignItems: "center" }}>
              <Text
                style={{ fontSize: 22, color: COLORS.primary, ...FONTS.body1 }}
              >
                {transactionLength}
              </Text>
              <Text
                style={{ fontSize: 14, color: COLORS.primary, ...FONTS.body4 }}
              >
                Transactions
              </Text>
            </View>
          );
        }}
      />
      {renderLegendComponent(dataSorted)}
    </View>
  );
};

export default PieChartWithLegend;
