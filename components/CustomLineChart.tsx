import React from "react";
import { View, Text, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface CumulativeDataPoint {
  date: string;
  value: number;
}

interface CustomLineChartProps {
  cumulativeBalance: CumulativeDataPoint[];
  cumulativeExpenditure: CumulativeDataPoint[];
}

const formatYLabel = (amount: string): string => {
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
};

const CustomLineChart: React.FC<CustomLineChartProps> = ({
  cumulativeBalance,
  cumulativeExpenditure,
}) => {
  const { COLORS } = useTheme();
  const maxValue = Math.max(
    cumulativeBalance[cumulativeBalance.length - 1].value,
    cumulativeExpenditure[cumulativeExpenditure.length - 1].value
  );

  return (
    <View style={{ marginTop: 20, marginBottom: 20 }}>
      <LineChart
        yAxisTextStyle={{ color: COLORS.primary, ...FONTS.body4 }}
        noOfSections={3}
        hideRules={true}
        isAnimated={true}
        animationDuration={200}
        formatYLabel={formatYLabel}
        maxValue={maxValue}
        pointerConfig={{
          pointerStripUptoDataPoint: true,
          pointerStripColor: "lightgray",
          pointerStripWidth: 2,
          strokeDashArray: [2, 5],
          pointerColor: "lightgray",
          radius: 4,
          pointerLabelWidth: 100,
          pointerLabelHeight: 120,
          pointerVanishDelay: 2000,
          pointerLabelComponent: (items: any[]) => {
            return (
              <View
                style={{
                  height: 120,
                  width: 100,
                  backgroundColor: COLORS.white,
                  borderRadius: 4,
                  justifyContent: "center",
                  paddingLeft: 16,
                  position: "relative",
                  elevation: 2,
                }}
              >
                <Text style={{ color: COLORS.secondary, fontSize: 12 }}>{"Spent"}</Text>
                <Text style={{ color: COLORS.black, fontWeight: "bold" }}>
                  {items[0].value}
                </Text>
                <Text style={{ color: COLORS.blue, fontSize: 12, marginTop: 12 }}>
                  {"Limit"}
                </Text>
                <Text style={{ color: COLORS.black, fontWeight: "bold" }}>
                  {items[1].value}
                </Text>
              </View>
            );
          },
        }}
        rulesColor={COLORS.darkgray}
        areaChart
        data={cumulativeExpenditure}
        data2={cumulativeBalance}
        height={320}
        initialSpacing={0}
        color1={COLORS.secondary}
        color2={COLORS.darkgray}
        hideDataPoints
        backgroundColor={"transparent"}
        yAxisColor="transparent"
        xAxisColor="transparent"
        dataPointsColor1="orange"
        dataPointsColor2="lightgrey"
        startFillColor1="orange"
        startFillColor2="lightgrey"
        endFillColor1="orange"
        endFillColor2="lightgrey"
        startOpacity={0.3}
        endOpacity={0.3}
        width={SCREEN_WIDTH - SIZES.padding * 2 - SIZES.padding * 0.7 * 2 - 35}
        adjustToWidth={true}
      />
    </View>
  );
};

export default CustomLineChart;
