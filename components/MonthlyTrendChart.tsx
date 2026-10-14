import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { FONTS } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { useTheme } from "../contexts/ThemeContext";

const { width: screenWidth } = Dimensions.get("window");

interface MonthlyDataPoint {
  value: number;
  label: string;
  dataPointText?: string;
  month: number;
  year: number;
  transactionCount: number;
}

interface MonthlyTrendChartProps {
  data: MonthlyDataPoint[];
  height?: number;
  // Both additive/optional — default preserves this component's original
  // behavior exactly, so the existing SubcategoryStatScreen call site needs
  // no changes. lineColor lets a caller (e.g. FundDetailScreen) match its
  // own accent instead of the hardcoded lightBlue; countLabel lets the
  // tooltip say something other than "transactions" for non-transaction data.
  lineColor?: string;
  countLabel?: string;
}

const formatYLabel = (amount: string): string => {
  const numAmount = Number(amount);
  if (numAmount >= 1000000000) {
    return (numAmount / 1000000000).toFixed(1) + "b";
  } else if (numAmount >= 1000000) {
    return (numAmount / 1000000).toFixed(1) + "m";
  } else if (numAmount >= 1000) {
    return (numAmount / 1000).toFixed(0) + "k";
  } else {
    return Math.round(numAmount).toString();
  }
};

const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({
  data,
  height = 240,
  lineColor,
  countLabel = "transactions",
}) => {
  const { COLORS } = useTheme();
  const resolvedColor = lineColor ?? COLORS.lightBlue;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current && data.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <View
        style={{
          height: height,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: COLORS.darkgray, ...FONTS.body3 }}>
          No data available
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((item) => item.value));
  const chartMaxValue = maxValue * 1.2;
  const chartWidth = screenWidth * 1.25;
  const pointSpacing = 40;

  return (
    <View style={{ marginTop: 10, marginBottom: 10 }}>
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            width: 25,
            height: height,
            justifyContent: "space-between",
            paddingVertical: 20,
          }}
        >
          {Array.from({ length: 5 }, (_, i) => {
            const value = (chartMaxValue / 4) * (4 - i);
            return (
              <Text
                key={i}
                style={{
                  color: COLORS.primary,
                  ...FONTS.body4,
                  fontSize: 12,
                  textAlign: "right",
                  paddingRight: 0,
                }}
              >
                {formatYLabel(value.toString())}
              </Text>
            );
          })}
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 10 }}
            decelerationRate="fast"
          >
            <LineChart
              // Valid runtime prop on gifted-charts LineChart but missing from its types.
              {...({ pointerStripUptoDataPoint: true } as any)}
              data={data}
              height={height}
              width={chartWidth}
              adjustToWidth={false}
              initialSpacing={15}
              spacing={pointSpacing}
              maxValue={chartMaxValue}
              hideYAxisText={true}
              yAxisLabelWidth={0}
              xAxisLabelTextStyle={{
                color: COLORS.primary,
                ...FONTS.body4,
                fontSize: 11,
                textAlign: "center",
              }}
              color={resolvedColor}
              thickness={3}
              noOfSections={4}
              yAxisColor="transparent"
              xAxisColor="transparent"
              rulesColor={COLORS.gray}
              rulesType="dashed"
              dataPointsColor={resolvedColor}
              dataPointsRadius={6}
              disableScroll={true}
              formatYLabel={formatYLabel}
              stripColor={resolvedColor}
              stripOpacity={0.5}
              stripHeight={height}
              stripWidth={2}
              textFontSize={0}
              textColor="transparent"
              isAnimated={false}
              animateOnDataChange={false}
              pressEnabled={true}
              showDataPointsOnPress={true}
              pointerConfig={{
                pointer1Color: resolvedColor,
                radius: 6,
                pointerStripUptoDataPoint: true,
                pointerStripColor: "lightgray",
                pointerStripWidth: 2,
                strokeDashArray: [2, 5],
                activatePointersOnLongPress: false,
                persistPointer: false,
                hidePointer1: false,
                hidePointer2: true,
                autoAdjustPointerLabelPosition: true,
                pointerLabelWidth: 120,
                pointerLabelHeight: 90,
                activatePointersDelay: 0,
                pointerVanishDelay: 4000,
                resetPointerOnDataChange: true,
                pointerLabelComponent: (items: any[]) => {
                  return (
                    <View
                      style={{
                        height: 90,
                        width: 120,
                        backgroundColor: COLORS.darkgray,
                        borderRadius: 8,
                        justifyContent: "center",
                        alignItems: "center",
                        shadowColor: "#000",
                        shadowOffset: {
                          width: 0,
                          height: 2,
                        },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                      }}
                    >
                      <Text
                        style={{
                          color: COLORS.white,
                          ...FONTS.body4,
                          textAlign: "center",
                          marginBottom: 4,
                        }}
                      >
                        {items[0].label} {items[0].year}
                      </Text>
                      <Text
                        style={{
                          color: COLORS.white,
                          ...FONTS.h4,
                          textAlign: "center",
                          marginBottom: 4,
                        }}
                      >
                        ₹{formatAmountWithCommas(items[0].value, false)}
                      </Text>
                      <Text
                        style={{
                          color: COLORS.lightGray2,
                          ...FONTS.body4,
                          textAlign: "center",
                        }}
                      >
                        {items[0].transactionCount} {countLabel}
                      </Text>
                    </View>
                  );
                },
              }}
            />
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

export default MonthlyTrendChart;
