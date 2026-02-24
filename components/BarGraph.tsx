import React from "react";
import { View, Text } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { FONTS } from "../constants";
import { formatAmountWithCommas } from "../services/_Utils";
import { useTheme } from "../contexts/ThemeContext";

interface BarDataItem {
  value: number;
  label?: string;
  frontColor?: string;
}

interface BarGraphProps {
  barData: BarDataItem[];
  average: number;
}

const BarGraph: React.FC<BarGraphProps> = ({ barData, average }) => {
  const { COLORS } = useTheme();
  const isMonthly = barData.length > 7;

  return (
    <View>
      <BarChart
        yAxisTextStyle={{ color: COLORS.primary, ...FONTS.body4 }}
        xAxisLabelTextStyle={{ color: COLORS.primary }}
        barWidth={isMonthly ? 6 : 20}
        formatYLabel={(amount: string) => {
          const numAmount = Number(amount);
          if (numAmount >= 1000000000) {
            return (numAmount / 1000000000).toFixed(2) + "b";
          } else if (numAmount >= 1000000) {
            return (numAmount / 1000000).toFixed(2) + "m";
          } else if (numAmount >= 1000) {
            return (numAmount / 1000).toFixed(1) + "k";
          } else {
            return numAmount.toString();
          }
        }}
        animationDuration={300}
        spacing={isMonthly ? 3.5 : 20}
        noOfSections={3}
        barBorderRadius={4}
        frontColor={COLORS.darkgray}
        data={barData}
        yAxisThickness={0}
        xAxisThickness={0}
        hideRules
        showReferenceLine1
        yAxisExtraHeight={20}
        labelWidth={14}
        height={180}
        referenceLine1Position={average}
        referenceLine1Config={{
          color: "gray",
          dashWidth: 2,
          dashGap: 3,
        }}
        renderTooltip={(item: BarDataItem) => {
          return (
            <View
              style={{
                marginLeft: item.value > 999 ? -15 : -6,
                backgroundColor: COLORS.lightGray2,
                borderRadius: 4,
              }}
            >
              <Text>₹{formatAmountWithCommas(item.value, false)}</Text>
            </View>
          );
        }}
      />
    </View>
  );
};

export default BarGraph;
