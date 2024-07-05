import React from "react";
import { View, Text } from "react-native";
import { LineChart, PieChart } from "react-native-gifted-charts";
import { COLORS, FONTS, PRETTYCOLORS } from "../constants";

const CustomLineChart = ({ cumulativeBalance, cumulativeExpenditure }) => {
  return (
    <View style={{ marginTop: 20, marginBottom: 20 }}>
      <LineChart
        yAxisTextStyle={{ color: COLORS.primary, ...FONTS.body4 }}
        noOfSections={3}
        hide={true}
        isAnimated={true}
        animationDuration={200}
        formatYLabel={(amount) => {
          amount = Number(amount);
          if (amount >= 1000000000) {
            return (amount / 1000000000).toFixed(2) + "b";
          } else if (amount >= 1000000) {
            return (amount / 1000000).toFixed(2) + "m";
          } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + "k";
          } else {
            return amount.toString();
          }
        }}
        maxValue={Math.max(
          cumulativeBalance[cumulativeBalance.length - 1].value,
          cumulativeExpenditure[cumulativeExpenditure.length - 1].value,
        )}
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
          pointerLabelComponent: (items) => {
            return (
              <View
                style={{
                  height: 120,
                  width: 100,
                  backgroundColor: "#282C3E",
                  borderRadius: 4,
                  justifyContent: "center",
                  paddingLeft: 16,
                  position: "relative",
                }}
              >
                <Text style={{ color: "orange", fontSize: 12 }}>{"Spent"}</Text>
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {items[0].value}
                </Text>
                <Text style={{ color: "skyblue", fontSize: 12, marginTop: 12 }}>
                  {"Limit"}
                </Text>
                <Text style={{ color: "white", fontWeight: "bold" }}>
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
        color1="orange"
        color2="grey"
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
        width={300}
        adjustToWidth={true}
      />
    </View>
  );
};
export default CustomLineChart;
