import { useCallback, useState } from "react";
import { LayoutChangeEvent } from "react-native";

export interface Plot {
  /** Full measured width. */
  width: number;
  height: number;
  /** Drawable area inside the axis padding. */
  left: number;
  top: number;
  plotWidth: number;
  plotHeight: number;
}

/** Measures the chart's width and derives the plot area inside axis padding. */
export const useChartLayout = (
  height: number,
  pad: { left?: number; right?: number; top?: number; bottom?: number } = {},
) => {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width)), []);
  const left = pad.left ?? 0;
  const right = pad.right ?? 0;
  const top = pad.top ?? 12;
  const bottom = pad.bottom ?? 22;
  const plot: Plot = {
    width,
    height,
    left,
    top,
    plotWidth: Math.max(0, width - left - right),
    plotHeight: Math.max(0, height - top - bottom),
  };
  return { plot, onLayout, ready: width > 0 };
};
