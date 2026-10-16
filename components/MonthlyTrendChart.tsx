import React, { useRef, useEffect } from "react";
import { View, ScrollView, Dimensions, StyleSheet } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { FONT, RADIUS, SPACE, TYPE } from "../constants";
import { formatAmountWithCommas } from "../services/Utils";
import { useTheme } from "../contexts/ThemeContext";
import { Text } from "./ui";

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
  // Both optional. lineColor lets a caller (e.g. FundDetailScreen) match its
  // own colour; countLabel lets the tooltip say something other than
  // "transactions" for non-transaction data.
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

const TOOLTIP_W = 120;
const TOOLTIP_H = 76;

const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({
  data,
  height = 240,
  lineColor,
  countLabel = "transactions",
}) => {
  const { COLORS } = useTheme();
  const resolvedColor = lineColor ?? COLORS.ink;
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
      <View style={[styles.empty, { height }]}>
        <Text variant="callout" tone="muted">
          No data yet
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((item) => item.value));
  const chartMaxValue = maxValue * 1.2;
  const chartWidth = screenWidth * 1.25;
  const pointSpacing = 40;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.yAxis, { height }]}>
          {Array.from({ length: 5 }, (_, i) => {
            const value = (chartMaxValue / 4) * (4 - i);
            return (
              <Text key={i} variant="caption" tone="subtle" align="right" style={styles.tabular}>
                {formatYLabel(value.toString())}
              </Text>
            );
          })}
        </View>

        <View style={styles.flex}>
          <ScrollView
            ref={scrollViewRef}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
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
                ...TYPE.caption,
                fontFamily: FONT.medium,
                color: COLORS.inkMuted,
                textAlign: "center",
              }}
              color={resolvedColor}
              thickness={2}
              noOfSections={4}
              yAxisColor="transparent"
              xAxisColor="transparent"
              rulesColor={COLORS.hairline}
              rulesType="dashed"
              dataPointsColor={resolvedColor}
              dataPointsRadius={3.5}
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
                radius: 5,
                pointerStripUptoDataPoint: true,
                pointerStripColor: COLORS.inkSubtle,
                pointerStripWidth: 1,
                strokeDashArray: [2, 5],
                activatePointersOnLongPress: false,
                persistPointer: false,
                hidePointer1: false,
                hidePointer2: true,
                autoAdjustPointerLabelPosition: true,
                pointerLabelWidth: TOOLTIP_W,
                pointerLabelHeight: TOOLTIP_H,
                activatePointersDelay: 0,
                pointerVanishDelay: 4000,
                resetPointerOnDataChange: true,
                pointerLabelComponent: (items: any[]) => (
                  <View style={[styles.tooltip, { backgroundColor: COLORS.ink }]}>
                    <Text variant="caption" align="center" style={{ color: COLORS.paper }}>
                      {items[0].label} {items[0].year}
                    </Text>
                    <Text variant="amount" align="center" style={{ color: COLORS.paper }}>
                      ₹{formatAmountWithCommas(items[0].value, false)}
                    </Text>
                    <Text variant="caption" align="center" style={{ color: COLORS.paper, opacity: 0.7 }}>
                      {items[0].transactionCount} {countLabel}
                    </Text>
                  </View>
                ),
              }}
            />
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginVertical: SPACE.sm },
  row: { flexDirection: "row" },
  flex: { flex: 1 },
  empty: { justifyContent: "center", alignItems: "center" },
  yAxis: { width: 28, justifyContent: "space-between", paddingVertical: 20 },
  tabular: { fontVariant: ["tabular-nums"] },
  scrollContent: { paddingRight: SPACE.sm },
  tooltip: {
    width: TOOLTIP_W,
    height: TOOLTIP_H,
    borderRadius: RADIUS.sm,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
});

export default MonthlyTrendChart;
