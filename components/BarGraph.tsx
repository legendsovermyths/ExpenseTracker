import React from "react";
import { View, Text, Dimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { FONT, SPACE, TYPE } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { useTheme } from "../contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Boxless: spans the gutter, minus the y-axis label column.
const GRAPH_WIDTH = SCREEN_WIDTH - SPACE.gutter * 2 - 36;

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

  const barWidth = isMonthly ? 7 : 22;
  const spacing = isMonthly ? 5.5 : 20;

  return (
    <View>
      <BarChart
        yAxisTextStyle={{ ...TYPE.caption, fontSize: 10, color: COLORS.inkSubtle }}
        xAxisLabelTextStyle={{ ...TYPE.caption, fontSize: 10, color: COLORS.inkMuted }}
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
        frontColor={COLORS.ink}
        data={barData}
        yAxisThickness={0}
        xAxisThickness={0}
        hideRules
        // An "Avg ₹0" line just collides with the axis labels.
        showReferenceLine1={average > 0}
        yAxisExtraHeight={20}
        xAxisLabelsHeight={22}
        height={160}
        width={GRAPH_WIDTH}
        initialSpacing={5}
        endSpacing={10}
        referenceLine1Position={average}
        referenceLine1Config={{
          color: COLORS.inkMuted,
          dashWidth: 4,
          dashGap: 4,
          thickness: 1,
          labelText: `Avg ₹${formatAmountWithCommas(average, false)}`,
          labelTextStyle: { color: COLORS.inkMuted, fontSize: 9, fontFamily: FONT.bold },
        }}
        renderTooltip={(item: BarDataItem) => {
          return (
            <View
              style={{
                marginLeft: item.value > 999 ? -15 : -6,
                backgroundColor: COLORS.paper,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: COLORS.hairline,
              }}
            >
              <Text style={{ ...TYPE.caption, fontSize: 10, color: COLORS.ink, fontVariant: ["tabular-nums"] }}>
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
