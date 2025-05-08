import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { PieChart, PieChartPro } from "react-native-gifted-charts";
import { COLORS, FONTS } from "../constants";
import { useNavigation } from "@react-navigation/native";

const PieChartWithLegend = ({
  data,
  transactionLength,
  clickableLegend = 0,
}) => {
  const dataSorted = data.sort((a, b) => {
    return a.value > b.value;
  });

  const navigation = useNavigation();
  const [selectedSlice, setSelectedSlice] = useState({});
  const renderDot = (color, label) => {
    return (
      <View
        style={{
          height: label == selectedSlice.label ? 12 : 10,
          width: label == selectedSlice.label ? 12 : 10,
          borderRadius: 5,
          backgroundColor: color,
          marginRight: 10,
        }}
      />
    );
  };
  const handleCategoryClick = (label, value, category, startDate, endDate) => {
    navigation.navigate("SubcategoryStat", {
      category: category,
      percentage: value,
      startDate: startDate,
      endDate: endDate,
    });
  };

  const renderLegendComponent = (categories) => {
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
            clickableLegend == 0 ? (
              <View
                key={index}
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
            ) : (
              <TouchableOpacity
                key={index}
                onPress={() =>
                  handleCategoryClick(
                    category.label,
                    category.value,
                    category.category,
                    category.startDate,
                    category.endDate,
                  )
                }
              >
                <View
                  key={index}
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
            ),
          )}
        </View>,
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
        onPress={(slice) => {
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
