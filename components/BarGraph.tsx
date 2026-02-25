import React from "react";
import { View, Text, Dimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { FONTS, SIZES } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { useTheme } from "../contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Full width minus: screen padding (2x), card padding (2x), some extra for y-axis labels
const GRAPH_WIDTH = SCREEN_WIDTH - SIZES.padding * 4 - 30;

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

  // Calculate bar width and spacing based on data length
  const availableWidth = GRAPH_WIDTH;
  const barCount = barData.length || 1;
  const totalBarSpace = availableWidth / barCount;

  // For weekly view, use more spacing to center the graph better
  const barWidth = isMonthly ? Math.min(8, totalBarSpace * 0.6) : Math.min(28, totalBarSpace * 0.55);
  const spacing = isMonthly ? Math.max(2, totalBarSpace * 0.3) : Math.max(12, totalBarSpace * 0.35);

  return (
    <View>
      <BarChart
        yAxisTextStyle={{ color: COLORS.darkgray, ...FONTS.body5 }}
        xAxisLabelTextStyle={{ color: COLORS.darkgray, ...FONTS.body5 }}
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
        yAxisExtraHeight={20}
        labelWidth={isMonthly ? 10 : 18}
        height={160}
        width={GRAPH_WIDTH}
        initialSpacing={isMonthly ? 5 : 10}
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
