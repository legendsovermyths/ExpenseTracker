import React from "react";
import { format } from "date-fns";
import { BarChart } from "./charts";

interface BarDataItem {
  value: number;
  label?: string;
  date?: string;
  frontColor?: string;
}

interface BarGraphProps {
  barData: BarDataItem[];
  average: number;
}

/** Spending-pattern bars (Transactions → Summary). Above-average days stand out. */
const BarGraph: React.FC<BarGraphProps> = ({ barData, average }) => {
  const weekly = barData.length <= 7;
  const data = barData.map((b) => ({
    value: b.value,
    label: b.label ?? (b.date ? format(new Date(b.date), "d") : ""),
    highlight: !!b.frontColor,
  }));
  return (
    <BarChart
      data={data}
      average={average}
      height={170}
      maxLabels={7}
      tooltipLabel={(i) => (barData[i].date ? format(new Date(barData[i].date!), "EEE, d MMM") : data[i].label)}
      accessibilityLabel={`Spending by ${weekly ? "day this week" : "day this month"}, average ₹${Math.round(average)}`}
    />
  );
};

export default BarGraph;
