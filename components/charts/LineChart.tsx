import React, { useEffect, useMemo } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "../../contexts/ThemeContext";
import { compactAmount, linearScale, linePath, areaPath, niceTicks, thinLabels } from "./scale";
import { useChartLayout } from "./useChartLayout";
import { useScrub } from "./useScrub";
import Axis from "./Axis";
import ChartTooltip, { Guideline } from "./ChartTooltip";

import { useCurrency } from "../../constants/currency";
const APath = Animated.createAnimatedComponent(Path);
const ARect = Animated.createAnimatedComponent(Rect);

export interface LineSeries {
  /** Values in rupees, one per label. Use NaN for "no data yet" (line stops). */
  data: number[];
  color?: string;
  dashed?: boolean;
  /** Gradient area under the line (default: first series only). */
  fill?: boolean;
  name?: string;
}

export interface LineChartProps {
  series: LineSeries[];
  labels: string[];
  height?: number;
  /** Max bottom labels before thinning. */
  maxLabels?: number;
  /** Tooltip title for an index (defaults to the label). */
  tooltipLabel?: (index: number) => string;
  /** Second tooltip line; defaults to the named comparison series' value. */
  tooltipDetail?: (index: number) => string | undefined;
  onSelect?: (index: number | null) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const TOOLTIP_SPACE = 44;

/** Smooth line chart with draw-in, morphing updates and drag-to-scrub. */
const LineChart: React.FC<LineChartProps> = ({
  series,
  labels,
  height = 180,
  maxLabels = 6,
  tooltipLabel,
  tooltipDetail,
  onSelect,
  accessibilityLabel,
  style,
}) => {
  const { COLORS } = useTheme();
  const currency = useCurrency();
  const reduced = useReducedMotion();
  const { plot, onLayout, ready } = useChartLayout(height + TOOLTIP_SPACE, { top: TOOLTIP_SPACE + 8, bottom: 22, right: 0 });
  const n = labels.length;

  const all = series.flatMap((s) => s.data.filter((v) => Number.isFinite(v)));
  const ticks = niceTicks(all.length ? Math.min(...all) : 0, all.length ? Math.max(...all) : 0, 3);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const base = plot.top + plot.plotHeight;
  const x = linearScale(0, Math.max(n - 1, 1), plot.left + 4, plot.left + plot.plotWidth - 4);
  const y = linearScale(yMin, yMax, base, plot.top);

  const ySeries = useMemo(
    () => series.map((s) => s.data.map((v) => (Number.isFinite(v) ? y(v) : NaN))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, plot.plotHeight, yMin, yMax],
  );
  const xs = useMemo(() => Array.from({ length: n }, (_, i) => x(i)), [n, plot.plotWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const { gesture, active } = useScrub({ count: n, plotLeft: plot.left, plotWidth: plot.plotWidth, onSelect });

  // Reveal (draw-in) once; morph between datasets afterwards.
  const reveal = useSharedValue(reduced ? 1 : 0);
  const morph = useSharedValue(1);
  const from = useSharedValue<number[][]>(ySeries);
  const to = useSharedValue<number[][]>(ySeries);

  useEffect(() => {
    if (!ready) return;
    const sameShape =
      to.value.length === ySeries.length && to.value.every((s, i) => s.length === ySeries[i].length);
    from.value = sameShape && reveal.value > 0 ? to.value : ySeries;
    to.value = ySeries;
    morph.value = 0;
    morph.value = withTiming(1, { duration: reduced ? 0 : 380, easing: Easing.out(Easing.cubic) });
    if (reveal.value === 0) reveal.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [ySeries, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const clipProps = useAnimatedProps(() => ({ width: plot.width * reveal.value }));

  const keep = thinLabels(n, maxLabels);
  const xLabels = labels
    .map((l, i) => ({ x: xs[i], label: l, strong: active === i }))
    .filter((_, i) => keep[i] || active === i);

  const primary = series[0];
  const activeValue = active !== null ? primary?.data[active] : undefined;
  const compare = series.find((s, i) => i > 0 && s.name);
  const compareValue = active !== null && compare ? compare.data[active] : undefined;

  return (
    <View
      // Charts size to their container; stretch so a centring parent can't collapse them to 0.
      style={[{ alignSelf: "stretch" }, style]}
      onLayout={onLayout}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {ready && (
        <GestureDetector gesture={gesture}>
          <View>
            <Svg width={plot.width} height={plot.height}>
              <Defs>
                <ClipPath id="reveal">
                  <ARect x={0} y={0} height={plot.height} animatedProps={clipProps} />
                </ClipPath>
                {series.map((s, si) => (
                  <LinearGradient key={si} id={`fill-${si}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={s.color ?? COLORS.accent} stopOpacity={0.22} />
                    <Stop offset="1" stopColor={s.color ?? COLORS.accent} stopOpacity={0} />
                  </LinearGradient>
                ))}
              </Defs>
              <Axis
                ticks={ticks}
                y={y}
                left={plot.left}
                right={plot.left + plot.plotWidth}
                baseline={base}
                xLabels={xLabels}
              />
              <G clipPath="url(#reveal)">
                {series
                  .map((s, si) => ({ s, si }))
                  .reverse()
                  .map(({ s, si }) => (
                    <SeriesPaths
                      key={si}
                      index={si}
                      xs={xs}
                      from={from}
                      to={to}
                      morph={morph}
                      base={base}
                      color={s.color ?? (si === 0 ? COLORS.accent : COLORS.inkSubtle)}
                      dashed={!!s.dashed}
                      fill={s.fill ?? si === 0}
                    />
                  ))}
              </G>
              {active !== null &&
                series.map((s, si) =>
                  Number.isFinite(s.data[active]) ? (
                    <Circle
                      key={si}
                      cx={xs[active]}
                      cy={y(s.data[active])}
                      r={si === 0 ? 4.5 : 3.5}
                      fill={COLORS.paper}
                      stroke={s.color ?? (si === 0 ? COLORS.accent : COLORS.inkSubtle)}
                      strokeWidth={2}
                    />
                  ) : null,
                )}
            </Svg>
            {active !== null && (
              <>
                <Guideline x={xs[active]} top={TOOLTIP_SPACE} height={base - TOOLTIP_SPACE} />
                <ChartTooltip
                  x={xs[active]}
                  chartWidth={plot.width}
                  label={tooltipLabel ? tooltipLabel(active) : labels[active]}
                  value={Number.isFinite(activeValue) ? (activeValue as number) : 0}
                  detail={
                    tooltipDetail
                      ? tooltipDetail(active)
                      : compare && Number.isFinite(compareValue)
                      ? `${compare.name} ${compactAmount(compareValue as number, currency.symbol, currency.units)}`
                      : undefined
                  }
                />
              </>
            )}
          </View>
        </GestureDetector>
      )}
      {!ready && <View style={{ height: plot.height }} />}
    </View>
  );
};

const SeriesPaths: React.FC<{
  index: number;
  xs: number[];
  from: { value: number[][] };
  to: { value: number[][] };
  morph: { value: number };
  base: number;
  color: string;
  dashed: boolean;
  fill: boolean;
}> = ({ index, xs, from, to, morph, base, color, dashed, fill }) => {
  const build = (closed: boolean) => {
    "worklet";
    const a = from.value[index] ?? [];
    const b = to.value[index] ?? [];
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < b.length; i++) {
      const yb = b[i];
      if (!(yb === yb)) break; // NaN → line stops here
      const ya = a[i] === a[i] && a[i] !== undefined ? a[i] : yb;
      pts.push({ x: xs[i], y: ya + (yb - ya) * morph.value });
    }
    return closed ? areaPath(pts, base) : linePath(pts);
  };
  const lineProps = useAnimatedProps(() => ({ d: build(false) }));
  const areaProps = useAnimatedProps(() => ({ d: build(true) }));
  return (
    <G>
      {fill && <APath animatedProps={areaProps} fill={`url(#fill-${index})`} />}
      <APath
        animatedProps={lineProps}
        fill="none"
        stroke={color}
        strokeWidth={dashed ? 1.5 : 2}
        strokeDasharray={dashed ? "4 4" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
};

export default LineChart;
