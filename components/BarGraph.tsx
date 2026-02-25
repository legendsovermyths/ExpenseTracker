import React from "react";
import { View, Text, Dimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { FONTS, SIZES } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { useTheme } from "../contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Full width minus: screen padding (2x), card padding (2x)
const GRAPH_WIDTH = SCREEN_WIDTH - SIZES.padding * 4 - 20;

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

  // Calculate dimensions based on view type
  const barWidth = isMonthly ? 6 : 28;
  const spacing = isMonthly ? 4 : 14;
  const labelWidth = isMonthly ? 12 : 20;

  return (
    <View style={{ alignItems: 'center' }}>
      <BarChart
        yAxisTextStyle={{ color: COLORS.darkgray, ...FONTS.body5, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: COLORS.darkgray, ...FONTS.body5, fontSize: 9 }}
        barWidth={barWidth}
        formatYLabel={(amount: string) => {
          const numAmount = Number(amount);
          if (numAmount >= 1000000000) {
            return (numAmount / 1000000000).toFixed(1) + "b";
          } else if (numAmount >= 1000000) {
            return (numAmount / 1000000).toFixed(1) + "m";
          } else if (numAmount >= 1000) {
            return (numAmount / 1000).toFixed(0) + "k";
          } else {
            return numAmount.toString();
          }
        }}
        animationDuration={300}
        spacing={spacing}
        noOfSections={3}
        barBorderRadius={4}
        frontColor={COLORS.primary}
        data={barData}
        yAxisThickness={0}
        xAxisThickness={0}
        hideRules
        showReferenceLine1
        yAxisExtraHeight={15}
        labelWidth={labelWidth}
        height={140}
        width={GRAPH_WIDTH}
        initialSpacing={8}
        endSpacing={8}
        referenceLine1Position={average}
        referenceLine1Config={{
          color: COLORS.red2,
          dashWidth: 4,
          dashGap: 4,
          thickness: 1,
        }}
        renderTooltip={(item: BarDataItem) => {
          return (
            <View
              style={{
                marginLeft: item.value > 999 ? -15 : -6,
                backgroundColor: COLORS.white,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: COLORS.lightGray,
              }}
            >
              <Text style={{ ...FONTS.body5, color: COLORS.primary }}>
                ₹{formatAmountWithCommas(item.value, false)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
};

export default BarGraph;
