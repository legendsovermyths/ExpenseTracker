import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SPACE } from "../constants";
import { LineChart } from "./charts";
import { SegmentedControl, Text } from "./ui";

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

type Range = "6m" | "1y" | "all";
const RANGE_MONTHS: Record<Range, number> = { "6m": 6, "1y": 12, all: Infinity };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month-by-month line with a 6M / 1Y / All range switch (oldest → newest). */
const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({
  data,
  height = 160,
  lineColor,
  countLabel = "transactions",
}) => {
  const options = useMemo(() => {
    const o: { key: Range; label: string }[] = [{ key: "6m", label: "6M" }];
    if (data.length > 6) o.push({ key: "1y", label: "1Y" });
    if (data.length > 12) o.push({ key: "all", label: "All" });
    return o;
  }, [data.length]);
  const [range, setRange] = useState<Range>("6m");
  useEffect(() => {
    if (!options.some((o) => o.key === range)) setRange("6m");
  }, [options, range]);

  const shown = useMemo(() => data.slice(-RANGE_MONTHS[range]), [data, range]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text variant="callout" tone="muted">
          No data yet
        </Text>
      </View>
    );
  }

  const monthName = (d: MonthlyDataPoint) => MONTHS[d.month] ?? d.label;
  const long = shown.length > 12;

  return (
    <View style={styles.wrap}>
      {options.length > 1 && (
        <SegmentedControl size="sm" value={range} onChange={setRange} options={options} style={styles.range} />
      )}
      <LineChart
        series={[{ data: shown.map((d) => d.value), color: lineColor }]}
        labels={shown.map((d) => (long ? monthName(d).slice(0, 1) : monthName(d)))}
        height={height}
        maxLabels={long ? 8 : 12}
        tooltipLabel={(i) => `${monthName(shown[i])} ${shown[i].year}`}
        tooltipDetail={(i) => `${shown[i].transactionCount} ${countLabel}`}
        accessibilityLabel={`Monthly trend over ${shown.length} months`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: SPACE.xs },
  range: { alignSelf: "flex-end", width: 150, marginBottom: SPACE.xs },
  empty: { justifyContent: "center", alignItems: "center" },
});

export default MonthlyTrendChart;
