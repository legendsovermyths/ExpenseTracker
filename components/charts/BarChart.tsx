import React, { useEffect, useRef } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import { FONT, MOTION } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import { bandScale, compactAmount, linearScale, niceTicks, thinLabels } from "./scale";
import { useChartLayout } from "./useChartLayout";
import { useScrub } from "./useScrub";
import Axis from "./Axis";
import ChartTooltip from "./ChartTooltip";

const APath = Animated.createAnimatedComponent(Path);

export interface BarDatum {
  /** Rupees. */
  value: number;
  label: string;
  /** Emphasise (e.g. today / current month). */
  highlight?: boolean;
}

export interface BarChartProps {
  data: BarDatum[];
  /** Dashed reference line, rupees. Hidden when 0. */
  average?: number;
  color?: string;
  height?: number;
  maxLabels?: number;
  tooltipLabel?: (index: number) => string;
  onSelect?: (index: number | null) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const TOOLTIP_SPACE = 44;
const RADIUS = 4;

/** Rounded-top bars that grow in, morph on change, and select on tap/drag. */
const BarChart: React.FC<BarChartProps> = ({
  data,
  average = 0,
  color,
  height = 180,
  maxLabels = 8,
  tooltipLabel,
  onSelect,
  accessibilityLabel,
  style,
}) => {
  const { COLORS } = useTheme();
  const tint = color ?? COLORS.accent;
  const { plot, onLayout, ready } = useChartLayout(height + TOOLTIP_SPACE, { top: TOOLTIP_SPACE + 8, bottom: 22 });
  const n = data.length;
  const max = Math.max(0, average, ...data.map((d) => d.value));
  const ticks = niceTicks(0, max, 3);
  const base = plot.top + plot.plotHeight;
  const y = linearScale(0, ticks[ticks.length - 1], base, plot.top);
  const band = bandScale(n, plot.plotWidth, n > 14 ? 0.35 : 0.45);

  const { gesture, active } = useScrub({
    count: n,
    plotLeft: plot.left + band.step / 2,
    plotWidth: Math.max(1, plot.plotWidth - band.step),
    onSelect,
    sticky: true,
  });

  const anyHighlight = data.some((d) => d.highlight);
  const keep = thinLabels(n, maxLabels);
  const xLabels = data
    .map((d, i) => ({ x: plot.left + band.center(i), label: d.label, strong: active === i || (!!d.highlight && active === null) }))
    .filter((_, i) => keep[i] || active === i);

  return (
    <View style={style} onLayout={onLayout} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {ready ? (
        <GestureDetector gesture={gesture}>
          <View>
            <Svg width={plot.width} height={plot.height}>
              <Axis ticks={ticks} y={y} left={plot.left} right={plot.left + plot.plotWidth} baseline={base} xLabels={xLabels} />
              {data.map((d, i) => {
                const dim = active !== null ? active !== i : anyHighlight && !d.highlight;
                return (
                  <Bar
                    key={i}
                    index={i}
                    x={plot.left + band.x(i)}
                    width={band.band}
                    top={y(d.value)}
                    base={base}
                    color={tint}
                    opacity={dim ? 0.35 : 1}
                  />
                );
              })}
              {average > 0 && (
                <>
                  <Line
                    x1={plot.left}
                    x2={plot.left + plot.plotWidth}
                    y1={y(average)}
                    y2={y(average)}
                    stroke={COLORS.inkMuted}
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  <SvgText x={plot.left} y={y(average) - 5} fontSize={10} fontFamily={FONT.bold} fill={COLORS.inkMuted}>
                    {`avg ${compactAmount(average, "₹")}`}
                  </SvgText>
                </>
              )}
            </Svg>
            {active !== null && (
              <ChartTooltip
                x={plot.left + band.center(active)}
                chartWidth={plot.width}
                label={tooltipLabel ? tooltipLabel(active) : data[active].label}
                value={data[active].value}
              />
            )}
          </View>
        </GestureDetector>
      ) : (
        <View style={{ height: plot.height }} />
      )}
    </View>
  );
};

const Bar: React.FC<{
  index: number;
  x: number;
  width: number;
  top: number;
  base: number;
  color: string;
  opacity: number;
}> = ({ index, x, width, top, base, color, opacity }) => {
  const reduced = useReducedMotion();
  const mounted = useRef(false);
  const h = useSharedValue(reduced ? base - top : 0);
  const alpha = useSharedValue(opacity);

  useEffect(() => {
    const target = Math.max(0, base - top);
    h.value =
      mounted.current || reduced
        ? withSpring(target, MOTION.spring)
        : withDelay(Math.min(index, 20) * 25, withSpring(target, MOTION.spring));
    mounted.current = true;
  }, [top, base]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    alpha.value = withTiming(opacity, { duration: 160 });
  }, [opacity]); // eslint-disable-line react-hooks/exhaustive-deps

  const props = useAnimatedProps(() => {
    const hh = Math.max(0, h.value);
    const r = Math.min(RADIUS, width / 2, hh);
    const t = base - hh;
    const d =
      hh <= 0.5
        ? ""
        : `M${x},${base} L${x},${t + r} Q${x},${t} ${x + r},${t} L${x + width - r},${t} Q${x + width},${t} ${x + width},${t + r} L${x + width},${base} Z`;
    return { d, opacity: alpha.value };
  });

  return <APath animatedProps={props} fill={color} />;
};

export default BarChart;
