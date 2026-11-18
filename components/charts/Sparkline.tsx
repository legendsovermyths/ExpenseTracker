import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { linePath } from "./scale";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color: string;
  strokeWidth?: number;
  /** Dot on the latest value. */
  endDot?: boolean;
}

/** Tiny trend line with no axes. Flat data sits at the midline. */
const Sparkline: React.FC<SparklineProps> = ({ data, width = 80, height = 22, color, strokeWidth = 1.5, endDot = true }) => {
  const pts = useMemo(() => {
    if (!data || data.length < 2) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const pad = strokeWidth + (endDot ? 1.5 : 0);
    const usableW = width - pad * 2;
    const usableH = height - pad * 2;
    return data.map((v, i) => ({
      x: pad + (i / (data.length - 1)) * usableW,
      y: range === 0 ? height / 2 : pad + usableH * (1 - (v - min) / range),
    }));
  }, [data, width, height, strokeWidth, endDot]);

  if (pts.length === 0) return <View style={{ width, height }} />;
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height}>
      <Path d={linePath(pts)} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {endDot && <Circle cx={last.x} cy={last.y} r={strokeWidth + 1} fill={color} />}
    </Svg>
  );
};

export default Sparkline;
