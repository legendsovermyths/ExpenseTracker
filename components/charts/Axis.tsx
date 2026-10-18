import React from "react";
import { G, Line, Text as SvgText } from "react-native-svg";
import { FONT } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import { compactAmount } from "./scale";

import { useCurrency } from "../../constants/currency";
interface Props {
  ticks: number[];
  y: (v: number) => number;
  left: number;
  right: number;
  /** x positions + labels for the bottom axis (already thinned). */
  xLabels?: { x: number; label: string; strong?: boolean }[];
  baseline: number;
  formatTick?: (v: number) => string;
}

/** Hairline gridlines with compact labels, plus bottom labels. */
const Axis: React.FC<Props> = ({ ticks, y, left, right, xLabels = [], baseline, formatTick }) => {
  const { COLORS } = useTheme();
  const { units } = useCurrency();
  const fmt = formatTick ?? ((v: number) => compactAmount(v, "", units));
  return (
    <G>
      {ticks.map((t) => (
        <G key={t}>
          <Line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke={COLORS.hairline} strokeWidth={1} />
          {t !== 0 && (
            <SvgText
              x={right}
              y={y(t) - 4}
              fontSize={10}
              fontFamily={FONT.medium}
              fill={COLORS.inkSubtle}
              textAnchor="end"
            >
              {fmt(t)}
            </SvgText>
          )}
        </G>
      ))}
      {xLabels.map((l, i) => (
        <SvgText
          key={`${l.label}-${i}`}
          x={l.x}
          y={baseline + 16}
          fontSize={10}
          fontFamily={l.strong ? FONT.bold : FONT.medium}
          fill={l.strong ? COLORS.ink : COLORS.inkMuted}
          textAnchor="middle"
        >
          {l.label}
        </SvgText>
      ))}
    </G>
  );
};

export default Axis;
