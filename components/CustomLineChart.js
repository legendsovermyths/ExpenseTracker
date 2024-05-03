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
        pointerConfig={{
          pointerStripUptoDataPoint: true,
          pointerStripColor: "lightgray",
          pointerStripWidth: 2,
          strokeDashArray: [2, 5],
          pointerColor: "lightgray",
          radius: 4,
          pointerLabelWidth: 100,
          pointerLabelHeight: 120,
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
                }}
              >
                <Text style={{ color: "orange", fontSize: 12 }}>{"Limit"}</Text>
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {items[0].value}
                </Text>
                <Text style={{ color: "skyblue", fontSize: 12, marginTop: 12 }}>
                  {"Spent"}
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
        curved
        data={cumulativeBalance}
        data2={cumulativeExpenditure}
        height={320}
        initialSpacing={0}
        color1="grey"
        color2="orange"
        hideDataPoints
        backgroundColor={"transparent"}
        yAxisColor="transparent"
        xAxisColor="transparent"
        dataPointsColor1="lightgrey"
        dataPointsColor2="orange"
        startFillColor1="lightgrey"
        startFillColor2="orange"
        endFillColor1="lightgrey"
        endFillColor2="orange"
        startOpacity={0.3}
        endOpacity={0.3}
        width={300}
        adjustToWidth={true}
      />
    </View>
  );
};
export default CustomLineChart;
