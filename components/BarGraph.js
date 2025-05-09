import { COLORS, FONTS, SIZES, icons, images } from "../constants";
import { BarChart } from "react-native-gifted-charts";
import { View, Text } from "react-native";
import { formatAmountWithCommas } from "../services/_Utils";

const barGraph = (barData, average) => {
  const isMonthly = barData.length > 7;
  return (
    <View>
      <BarChart
        yAxisTextStyle={{ color: COLORS.primary, ...FONTS.body4 }}
        xAxisLabelTextStyle={{ color: COLORS.primary }}
        barWidth={isMonthly ? 6 : 20}
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
        renderTooltip={(item) => {
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

export { barGraph };
