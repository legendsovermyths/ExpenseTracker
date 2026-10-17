import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { linePath } from "./scale";

const ARect = Animated.createAnimatedComponent(Rect);

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color: string;
  strokeWidth?: number;
  /** Dot on the latest value. */
  endDot?: boolean;
}

let uid = 0;

/** Tiny trend line with no axes; draws in on mount. Flat data sits at the midline. */
const Sparkline: React.FC<SparklineProps> = ({ data, width = 80, height = 22, color, strokeWidth = 1.5, endDot = true }) => {
  const reduced = useReducedMotion();
  const id = useMemo(() => `spark-${uid++}`, []);
  const reveal = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    reveal.value = withTiming(1, { duration: reduced ? 0 : 500, easing: Easing.out(Easing.cubic) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const clip = useAnimatedProps(() => ({ width: width * reveal.value }));

  if (pts.length === 0) return <View style={{ width, height }} />;
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id={id}>
          <ARect x={0} y={0} height={height} animatedProps={clip} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Path d={linePath(pts)} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {endDot && <Circle cx={last.x} cy={last.y} r={strokeWidth + 1} fill={color} />}
      </G>
    </Svg>
  );
};

export default Sparkline;
