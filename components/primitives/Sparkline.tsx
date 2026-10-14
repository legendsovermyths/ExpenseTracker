import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color: string;
  strokeWidth?: number;
}

// Stroke-only line, no axes, no labels. Renders flat at midline when
// values are all equal so it doesn't visually disappear.
const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 22,
  color,
  strokeWidth = 1.5,
}) => {
  const d = useMemo(() => {
    if (!data || data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const pad = strokeWidth;
    const usableH = height - pad * 2;
    return data
      .map((v, i) => {
        const x = i * stepX;
        const y = pad + usableH - ((v - min) / range) * usableH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [data, width, height, strokeWidth]);

  if (!d) return <View style={{ width, height }} />;

  return (
    <Svg width={width} height={height}>
      <Path
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
};

export default Sparkline;
