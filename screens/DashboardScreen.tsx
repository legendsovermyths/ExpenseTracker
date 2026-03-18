import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import Svg, { Path, Circle as SvgCircle } from "react-native-svg";
import { FONTS, SIZES, PRETTYCOLORS } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Icon } from "react-native-elements";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import TransactionCard from "../components/TransactionCard";
import CustomFAB from "../components/CustomFAB";
import {
  formatAmountWithCommas,
  filterTransactions,
  getMonthRange,
} from "../services/Utils";
import { Transaction } from "../types/entity/Transaction";
import { Category } from "../types/entity/Category";
import { Account } from "../types/entity/Account";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Semi-circular budget gauge ───────────────────────────────────
const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
};

const BudgetGauge: React.FC<{
  spent: number;
  budget: number;
  COLORS: ColorPalette;
}> = ({ spent, budget, COLORS }) => {
  const width = SCREEN_WIDTH - SIZES.padding * 2;
  const strokeWidth = 14;
  const radius = (width - strokeWidth) / 2 - 10;
  const cx = width / 2;
  const cy = width / 2;
  const svgHeight = width / 2 + 30;

  // Arc from 180° (left) to 360° (right) = top semicircle
  const startAngle = 180;
  const endAngle = 360;
  const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const progressAngle = startAngle + (endAngle - startAngle) * progress;

  const gaugeColor =
    progress > 0.9 ? COLORS.red2 : progress > 0.7 ? COLORS.yellow : COLORS.darkgreen;

  const dailyAvg = spent / Math.max(new Date().getDate(), 1);
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0,
  ).getDate();
  const idealDaily = budget / daysInMonth;

  const bgPath = describeArc(cx, cy, radius, startAngle, endAngle - 0.01);
  const progressPath = progress > 0.005
    ? describeArc(cx, cy, radius, startAngle, progressAngle)
    : "";

  return (
    <View style={{ alignItems: "center", marginBottom: -10 }}>
      <Svg width={width} height={svgHeight}>
        {/* Background track */}
        <Path
          d={bgPath}
          stroke={COLORS.lightGray2}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        {progressPath !== "" && (
          <Path
            d={progressPath}
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </Svg>
      {/* Center text overlay */}
      <View style={{ position: "absolute", top: svgHeight - 75, alignItems: "center" }}>
        <Text style={{ ...FONTS.h1, fontSize: 28, fontWeight: "800", color: COLORS.primary, letterSpacing: -1 }}>
          ₹{formatAmountWithCommas(spent, false)}
        </Text>
        <Text style={{ ...FONTS.body4, color: COLORS.darkgray, marginTop: 2 }}>
          of ₹{formatAmountWithCommas(budget, false)} budget
        </Text>
      </View>
      {/* Daily pace indicator */}
      <View style={{ flexDirection: "row", gap: SIZES.padding, marginTop: 4 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ ...FONTS.body3, fontWeight: "700", color: dailyAvg > idealDaily ? COLORS.red2 : COLORS.darkgreen }}>
            ₹{formatAmountWithCommas(dailyAvg, false)}
          </Text>
          <Text style={{ ...FONTS.body4, fontSize: 11, color: COLORS.darkgray }}>your pace/day</Text>
        </View>
        <View style={{ width: 1, height: 28, backgroundColor: COLORS.gray, opacity: 0.3 }} />
        <View style={{ alignItems: "center" }}>
          <Text style={{ ...FONTS.body3, fontWeight: "700", color: COLORS.primary }}>
            ₹{formatAmountWithCommas(idealDaily, false)}
          </Text>
          <Text style={{ ...FONTS.body4, fontSize: 11, color: COLORS.darkgray }}>ideal/day</Text>
        </View>
      </View>
    </View>
  );
};

// ─── Spending Heatmap ─────────────────────────────────────────────
const SpendingHeatmap: React.FC<{
  transactions: Transaction[];
  COLORS: ColorPalette;
}> = ({ transactions, COLORS }) => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();

  // Calculate daily spending
  const dailySpend: number[] = new Array(daysInMonth).fill(0);
  transactions.forEach((t) => {
    if (!t.is_credit) {
      const day = new Date(t.date_time).getDate();
      if (day >= 1 && day <= daysInMonth) {
        dailySpend[day - 1] += t.amount;
      }
    }
  });

  const maxSpend = Math.max(...dailySpend.filter((_, i) => i < currentDay), 1);

  const getColor = (amount: number, dayIndex: number) => {
    if (dayIndex >= currentDay) return COLORS.lightGray;
    if (amount === 0) return COLORS.darkgreen + "30";
    const intensity = Math.min(amount / maxSpend, 1);
    if (intensity < 0.25) return COLORS.darkgreen + "50";
    if (intensity < 0.5) return COLORS.yellow + "60";
    if (intensity < 0.75) return COLORS.peach + "70";
    return COLORS.red2 + "90";
  };

  // 7 columns layout
  const cols = 7;
  const gap = 4;
  const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const containerWidth = SCREEN_WIDTH - SIZES.padding * 2 - SIZES.padding * 1.4;
  const cellSize = (containerWidth - (cols - 1) * gap) / cols;
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  // Build grid with offset for first day
  const cells: Array<{ day: number; amount: number } | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 0; d < daysInMonth; d++) cells.push({ day: d + 1, amount: dailySpend[d] });
  // Pad end to complete the last row
  while (cells.length % cols !== 0) cells.push(null);

  const noSpendDays = dailySpend.slice(0, currentDay).filter((v) => v === 0).length;

  const rows: Array<Array<{ day: number; amount: number } | null>> = [];
  for (let i = 0; i < cells.length; i += cols) {
    rows.push(cells.slice(i, i + cols));
  }

  return (
    <View>
      {/* Day labels */}
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {dayLabels.map((label, i) => (
          <View key={i} style={{ width: cellSize, marginRight: i < cols - 1 ? gap : 0, alignItems: "center" }}>
            <Text style={{ ...FONTS.body4, fontSize: 10, color: COLORS.darkgray }}>{label}</Text>
          </View>
        ))}
      </View>
      {/* Grid — render row by row */}
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", marginBottom: rowIdx < rows.length - 1 ? gap : 0 }}>
          {row.map((cell, colIdx) => (
            <View
              key={`${rowIdx}-${colIdx}`}
              style={{
                width: cellSize,
                height: cellSize,
                marginRight: colIdx < cols - 1 ? gap : 0,
                borderRadius: 6,
                backgroundColor: cell ? getColor(cell.amount, cell.day - 1) : "transparent",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {cell && (
                <Text style={{ fontSize: 9, color: cell.day - 1 >= currentDay ? COLORS.gray : COLORS.primary, fontWeight: "500" }}>
                  {cell.day}
                </Text>
              )}
            </View>
          ))}
        </View>
      ))}
      {/* Legend */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: SIZES.base + 2 }}>
        <Text style={{ ...FONTS.body4, fontSize: 11, color: COLORS.darkgray }}>
          {noSpendDays} no-spend day{noSpendDays !== 1 ? "s" : ""}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Text style={{ fontSize: 10, color: COLORS.darkgray }}>Less</Text>
          {[COLORS.darkgreen + "30", COLORS.darkgreen + "50", COLORS.yellow + "60", COLORS.peach + "70", COLORS.red2 + "90"].map((c, i) => (
            <View key={i} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />
          ))}
          <Text style={{ fontSize: 10, color: COLORS.darkgray }}>More</Text>
        </View>
      </View>
    </View>
  );
};

// ─── Category bars ────────────────────────────────────────────────
const CategoryBars: React.FC<{
  transactions: Transaction[];
  categoriesById: Record<number, Category>;
  COLORS: ColorPalette;
}> = ({ transactions, categoriesById, COLORS }) => {
  const spending: Record<number, number> = {};
  transactions
    .filter((t) => !t.is_credit)
    .forEach((t) => {
      spending[t.category_id] = (spending[t.category_id] || 0) + t.amount;
    });

  const sorted = Object.entries(spending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxAmount = sorted[0] ? sorted[0][1] : 1;

  return (
    <View style={{ gap: SIZES.base + 2 }}>
      {sorted.map(([catId, amount], index) => {
        const category = categoriesById[Number(catId)];
        if (!category) return null;
        const barWidth = (amount / maxAmount) * 100;
        const color = PRETTYCOLORS[index % PRETTYCOLORS.length];

        return (
          <View key={catId} style={{ flexDirection: "row", alignItems: "center", gap: SIZES.base }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + "20", justifyContent: "center", alignItems: "center" }}>
              <Icon name={category.icon_name} type={category.icon_type} size={16} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "500", color: COLORS.primary }}>{category.name}</Text>
                <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "600", color: COLORS.primary }}>
                  ₹{formatAmountWithCommas(amount, false)}
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: COLORS.lightGray2, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: 6, width: `${barWidth}%`, backgroundColor: color, borderRadius: 3 }} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─── Weekend vs Weekday Card ──────────────────────────────────────
const WeekendVsWeekday: React.FC<{
  transactions: Transaction[];
  COLORS: ColorPalette;
}> = ({ transactions, COLORS }) => {
  const debits = transactions.filter((t) => !t.is_credit);
  if (debits.length < 3) return null;

  let weekdayTotal = 0, weekendTotal = 0;
  let weekdayCount = 0, weekendCount = 0;

  debits.forEach((t) => {
    const dow = new Date(t.date_time).getDay();
    if (dow === 0 || dow === 6) {
      weekendTotal += t.amount;
      weekendCount++;
    } else {
      weekdayTotal += t.amount;
      weekdayCount++;
    }
  });

  const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
  const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;
  const maxAvg = Math.max(weekdayAvg, weekendAvg, 1);

  return (
    <View style={{ gap: SIZES.base + 2 }}>
      {/* Weekday bar */}
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "500", color: COLORS.primary }}>Weekdays</Text>
          <Text style={{ ...FONTS.body4, fontSize: 12, color: COLORS.darkgray }}>
            avg ₹{formatAmountWithCommas(weekdayAvg, false)}/txn
          </Text>
        </View>
        <View style={{ height: 8, backgroundColor: COLORS.lightGray2, borderRadius: 4, overflow: "hidden" }}>
          <View style={{ height: 8, width: `${(weekdayAvg / maxAvg) * 100}%`, backgroundColor: COLORS.blue, borderRadius: 4 }} />
        </View>
      </View>
      {/* Weekend bar */}
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "500", color: COLORS.primary }}>Weekends</Text>
          <Text style={{ ...FONTS.body4, fontSize: 12, color: COLORS.darkgray }}>
            avg ₹{formatAmountWithCommas(weekendAvg, false)}/txn
          </Text>
        </View>
        <View style={{ height: 8, backgroundColor: COLORS.lightGray2, borderRadius: 4, overflow: "hidden" }}>
          <View style={{ height: 8, width: `${(weekendAvg / maxAvg) * 100}%`, backgroundColor: COLORS.purple, borderRadius: 4 }} />
        </View>
      </View>
      {weekendAvg > 0 && weekdayAvg > 0 && (
        <Text style={{ ...FONTS.body4, fontSize: 11, color: COLORS.darkgray, marginTop: 2 }}>
          {weekendAvg > weekdayAvg
            ? `Weekend transactions are ${((weekendAvg / weekdayAvg)).toFixed(1)}x larger on average`
            : `Weekday transactions are ${((weekdayAvg / weekendAvg)).toFixed(1)}x larger on average`}
        </Text>
      )}
    </View>
  );
};

// ─── Account Usage Donut ──────────────────────────────────────────
const AccountUsageDonut: React.FC<{
  transactions: Transaction[];
  accountsById: Record<number, Account>;
  COLORS: ColorPalette;
}> = ({ transactions, accountsById, COLORS }) => {
  const debits = transactions.filter((t) => !t.is_credit);
  if (debits.length < 2) return null;

  // Count transactions per account
  const usage: Record<number, number> = {};
  debits.forEach((t) => {
    usage[t.account_id] = (usage[t.account_id] || 0) + 1;
  });

  const sorted = Object.entries(usage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const total = sorted.reduce((a, [, c]) => a + c, 0);

  const donutSize = 80;
  const donutRadius = 30;
  const donutStroke = 10;
  const donutCenter = donutSize / 2;
  const circumference = 2 * Math.PI * donutRadius;

  let currentOffset = 0;
  const donutColors = [COLORS.blue, COLORS.purple, COLORS.peach, COLORS.yellow, COLORS.darkgreen];

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SIZES.padding }}>
      {/* Donut */}
      <Svg width={donutSize} height={donutSize}>
        {sorted.map(([accId, count], i) => {
          const segmentLength = (count / total) * circumference;
          const offset = currentOffset;
          currentOffset += segmentLength;
          return (
            <SvgCircle
              key={accId}
              cx={donutCenter}
              cy={donutCenter}
              r={donutRadius}
              stroke={donutColors[i % donutColors.length]}
              strokeWidth={donutStroke}
              fill="none"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-offset}
              rotation="-90"
              origin={`${donutCenter}, ${donutCenter}`}
            />
          );
        })}
      </Svg>
      {/* Legend */}
      <View style={{ flex: 1, gap: 4 }}>
        {sorted.map(([accId, count], i) => {
          const account = accountsById[Number(accId)];
          if (!account) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <View key={accId} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: donutColors[i % donutColors.length] }} />
              <Text style={{ ...FONTS.body4, fontSize: 12, color: COLORS.primary, flex: 1 }} numberOfLines={1}>
                {account.name}
              </Text>
              <Text style={{ ...FONTS.body4, fontSize: 12, fontWeight: "600", color: COLORS.darkgray }}>
                {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ─── Insights engine ──────────────────────────────────────────────
interface Insight {
  icon: string;
  text: string;
  color: string;
  bgColor: string;
}

const generateInsights = (
  currentMonthTransactions: Transaction[],
  prevMonthTransactions: Transaction[],
  allTransactions: Transaction[],
  categoriesById: Record<number, Category>,
  monthlyBudget: number,
  COLORS: ColorPalette,
): Insight[] => {
  const insights: Insight[] = [];
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const debits = currentMonthTransactions.filter((t) => !t.is_credit);

  if (debits.length === 0) return insights;

  const totalSpent = debits.reduce((acc, t) => acc + t.amount, 0);

  // 1. Spendiest day of the week
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
  debits.forEach((t) => {
    const dow = new Date(t.date_time).getDay();
    dayTotals[dow] += t.amount;
    dayCounts[dow]++;
  });
  const dayNames = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const maxDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
  if (dayTotals[maxDayIdx] > 0 && debits.length >= 3) {
    insights.push({
      icon: "calendar-week",
      text: `You spend the most on ${dayNames[maxDayIdx]}`,
      color: COLORS.purple,
      bgColor: COLORS.purple + "12",
    });
  }

  // 2. Most expensive day of the month
  const daySpend: Record<number, number> = {};
  debits.forEach((t) => {
    const d = new Date(t.date_time).getDate();
    daySpend[d] = (daySpend[d] || 0) + t.amount;
  });
  const peakDay = Object.entries(daySpend).sort(([, a], [, b]) => b - a)[0];
  if (peakDay && debits.length >= 3) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    insights.push({
      icon: "chart-bar",
      text: `${months[now.getMonth()]} ${peakDay[0]} was your biggest day: ₹${formatAmountWithCommas(Number(peakDay[1]), false)}`,
      color: COLORS.peach,
      bgColor: COLORS.peach + "12",
    });
  }

  // 3. Most repeated merchant/description
  const descCounts: Record<string, number> = {};
  debits.forEach((t) => {
    const desc = (t.description || "").trim();
    if (desc) descCounts[desc] = (descCounts[desc] || 0) + 1;
  });
  const topDesc = Object.entries(descCounts).sort(([, a], [, b]) => b - a)[0];
  if (topDesc && topDesc[1] >= 2) {
    insights.push({
      icon: "repeat",
      text: `${topDesc[0]} appears ${topDesc[1]} times this month`,
      color: COLORS.blue,
      bgColor: COLORS.blue + "12",
    });
  }

  // 4. Average transaction size
  if (debits.length >= 2) {
    const avg = totalSpent / debits.length;
    insights.push({
      icon: "calculator-variant-outline",
      text: `Your average expense is ₹${formatAmountWithCommas(avg, false)}`,
      color: COLORS.lightBlue,
      bgColor: COLORS.lightBlue + "15",
    });
  }

  // 5. Small vs large transaction ratio
  if (debits.length >= 5) {
    const median = [...debits].sort((a, b) => a.amount - b.amount)[Math.floor(debits.length / 2)].amount;
    const smallCount = debits.filter((t) => t.amount < median).length;
    const pct = Math.round((smallCount / debits.length) * 100);
    insights.push({
      icon: "scale-balance",
      text: `${pct}% of your transactions are under ₹${formatAmountWithCommas(median, false)}`,
      color: COLORS.darkgray,
      bgColor: COLORS.darkgray + "12",
    });
  }

  // 6. Category vs last month comparison
  const catSpend: Record<number, number> = {};
  debits.forEach((t) => {
    catSpend[t.category_id] = (catSpend[t.category_id] || 0) + t.amount;
  });
  const prevDebits = prevMonthTransactions.filter((t) => !t.is_credit && new Date(t.date_time).getDate() <= currentDay);
  const prevCatSpend: Record<number, number> = {};
  prevDebits.forEach((t) => {
    prevCatSpend[t.category_id] = (prevCatSpend[t.category_id] || 0) + t.amount;
  });

  // Find category with biggest increase
  let biggestIncreaseCat: { id: number; pct: number } | null = null;
  let biggestDecreaseCat: { id: number; pct: number } | null = null;
  for (const [catId, amount] of Object.entries(catSpend)) {
    const prev = prevCatSpend[Number(catId)] || 0;
    if (prev > 0) {
      const change = Math.round(((amount - prev) / prev) * 100);
      if (change > 20 && (!biggestIncreaseCat || change > biggestIncreaseCat.pct)) {
        biggestIncreaseCat = { id: Number(catId), pct: change };
      }
      if (change < -20 && (!biggestDecreaseCat || change < biggestDecreaseCat.pct)) {
        biggestDecreaseCat = { id: Number(catId), pct: change };
      }
    }
  }
  if (biggestIncreaseCat && categoriesById[biggestIncreaseCat.id]) {
    insights.push({
      icon: "trending-up",
      text: `${categoriesById[biggestIncreaseCat.id].name} is up ${biggestIncreaseCat.pct}% vs last month`,
      color: COLORS.red2,
      bgColor: COLORS.red2 + "12",
    });
  }
  if (biggestDecreaseCat && categoriesById[biggestDecreaseCat.id]) {
    insights.push({
      icon: "trending-down",
      text: `${categoriesById[biggestDecreaseCat.id].name} is down ${Math.abs(biggestDecreaseCat.pct)}% vs last month`,
      color: COLORS.darkgreen,
      bgColor: COLORS.darkgreen + "12",
    });
  }

  // 7. Projected month-end spend
  if (currentDay >= 5 && monthlyBudget > 0) {
    const projected = Math.round((totalSpent / currentDay) * daysInMonth);
    if (projected > monthlyBudget * 1.1) {
      insights.push({
        icon: "alert-circle-outline",
        text: `At this pace you'll spend ₹${formatAmountWithCommas(projected, false)} by month end`,
        color: COLORS.red2,
        bgColor: COLORS.red2 + "12",
      });
    } else if (projected < monthlyBudget * 0.8) {
      insights.push({
        icon: "party-popper",
        text: `On track to finish under budget at ₹${formatAmountWithCommas(projected, false)}`,
        color: COLORS.darkgreen,
        bgColor: COLORS.darkgreen + "12",
      });
    }
  }

  // 8. Already surpassed last month
  const prevMonthTotal = prevMonthTransactions.filter((t) => !t.is_credit).reduce((a, t) => a + t.amount, 0);
  if (prevMonthTotal > 0 && totalSpent > prevMonthTotal) {
    insights.push({
      icon: "alert-outline",
      text: `You've already spent more than all of last month`,
      color: COLORS.red2,
      bgColor: COLORS.red2 + "12",
    });
  }

  // 9. First half vs second half spending pattern
  if (currentDay > 16 && debits.length >= 5) {
    const firstHalf = debits.filter((t) => new Date(t.date_time).getDate() <= 15).reduce((a, t) => a + t.amount, 0);
    const secondHalf = debits.filter((t) => new Date(t.date_time).getDate() > 15).reduce((a, t) => a + t.amount, 0);
    if (firstHalf > 0 && secondHalf > 0) {
      const heavier = firstHalf > secondHalf ? "first" : "second";
      insights.push({
        icon: "calendar-range",
        text: `You spend more in the ${heavier} half of the month`,
        color: COLORS.purple,
        bgColor: COLORS.purple + "12",
      });
    }
  }

  // 10. Spending by time of day
  if (debits.length >= 4) {
    const timeBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    debits.forEach((t) => {
      const hour = new Date(t.date_time).getHours();
      if (hour >= 5 && hour < 12) timeBuckets.morning += t.amount;
      else if (hour >= 12 && hour < 17) timeBuckets.afternoon += t.amount;
      else if (hour >= 17 && hour < 21) timeBuckets.evening += t.amount;
      else timeBuckets.night += t.amount;
    });
    const timeLabels: Record<string, { label: string; icon: string; color: string }> = {
      morning: { label: "morning", icon: "weather-sunny", color: COLORS.yellow },
      afternoon: { label: "afternoon", icon: "white-balance-sunny", color: COLORS.peach },
      evening: { label: "evening", icon: "weather-sunset", color: COLORS.purple },
      night: { label: "night", icon: "weather-night", color: COLORS.lightBlue },
    };
    const topTime = Object.entries(timeBuckets).sort(([, a], [, b]) => b - a)[0];
    if (topTime[1] > 0) {
      const info = timeLabels[topTime[0]];
      insights.push({
        icon: info.icon,
        text: `You're a ${info.label} spender — most spending happens then`,
        color: info.color,
        bgColor: info.color + "15",
      });
    }
  }

  // 11. Weekend vs weekday
  if (debits.length >= 4) {
    let weekdayTotal = 0, weekendTotal = 0;
    let weekdayDays = 0, weekendDays = 0;
    // Count actual weekdays/weekends that have passed
    for (let d = 1; d <= currentDay; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) weekendDays++;
      else weekdayDays++;
    }
    debits.forEach((t) => {
      const dow = new Date(t.date_time).getDay();
      if (dow === 0 || dow === 6) weekendTotal += t.amount;
      else weekdayTotal += t.amount;
    });
    const weekdayDailyAvg = weekdayDays > 0 ? weekdayTotal / weekdayDays : 0;
    const weekendDailyAvg = weekendDays > 0 ? weekendTotal / weekendDays : 0;
    if (weekdayDailyAvg > 0 && weekendDailyAvg > 0) {
      const ratio = weekendDailyAvg / weekdayDailyAvg;
      if (ratio > 1.3) {
        insights.push({
          icon: "beach",
          text: `You spend ${ratio.toFixed(1)}x more per day on weekends`,
          color: COLORS.peach,
          bgColor: COLORS.peach + "12",
        });
      } else if (ratio < 0.7) {
        insights.push({
          icon: "briefcase-outline",
          text: `Weekdays cost you ${(1 / ratio).toFixed(1)}x more per day than weekends`,
          color: COLORS.blue,
          bgColor: COLORS.blue + "12",
        });
      }
    }
  }

  // 12. Category concentration
  if (Object.keys(catSpend).length >= 2 && debits.length >= 3) {
    const sortedCats = Object.values(catSpend).sort((a, b) => b - a);
    const top2 = sortedCats.slice(0, 2).reduce((a, b) => a + b, 0);
    const concentrationPct = Math.round((top2 / totalSpent) * 100);
    const numCategories = Object.keys(catSpend).length;
    if (concentrationPct > 75) {
      insights.push({
        icon: "target",
        text: `${concentrationPct}% of spending is in just 2 categories`,
        color: COLORS.peach,
        bgColor: COLORS.peach + "12",
      });
    } else if (numCategories >= 5) {
      insights.push({
        icon: "shape-outline",
        text: `You spread spending across ${numCategories} categories`,
        color: COLORS.darkgreen,
        bgColor: COLORS.darkgreen + "12",
      });
    }
  }

  // 13. Logging consistency streak
  let logStreak = 0;
  for (let d = currentDay; d >= 1; d--) {
    const hasTransaction = currentMonthTransactions.some(
      (t) => new Date(t.date_time).getDate() === d,
    );
    if (hasTransaction) logStreak++;
    else break;
  }
  if (logStreak >= 3) {
    insights.push({
      icon: "fire",
      text: `${logStreak} day logging streak — keep it up!`,
      color: COLORS.peach,
      bgColor: COLORS.peach + "12",
    });
  }

  // 14. Lifetime milestone
  const totalLifetimeTransactions = allTransactions.length;
  const milestones = [500, 250, 100, 50];
  for (const milestone of milestones) {
    if (totalLifetimeTransactions >= milestone) {
      insights.push({
        icon: "trophy-outline",
        text: `You've tracked ${totalLifetimeTransactions} transactions — nice!`,
        color: COLORS.yellow,
        bgColor: COLORS.yellow + "18",
      });
      break;
    }
  }

  // 15. Lowest spending week
  if (currentDay >= 14 && debits.length >= 5) {
    const weekTotals: number[] = [];
    const fullWeeks = Math.floor(currentDay / 7);
    for (let w = 0; w < fullWeeks; w++) {
      const weekStart = w * 7 + 1;
      const weekEnd = weekStart + 6;
      const weekTotal = debits
        .filter((t) => {
          const d = new Date(t.date_time).getDate();
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((a, t) => a + t.amount, 0);
      weekTotals.push(weekTotal);
    }
    if (weekTotals.length >= 2) {
      const minWeek = Math.min(...weekTotals);
      const minWeekIdx = weekTotals.indexOf(minWeek);
      const currentWeekIdx = fullWeeks - 1;
      if (minWeekIdx === currentWeekIdx) {
        insights.push({
          icon: "star-outline",
          text: `This is your lowest spending week so far this month`,
          color: COLORS.darkgreen,
          bgColor: COLORS.darkgreen + "12",
        });
      }
    }
  }

  // 16. Transaction volume vs last month
  const prevMonthTxCount = prevMonthTransactions.length;
  const currentTxCount = currentMonthTransactions.length;
  if (prevMonthTxCount > 0 && currentTxCount > prevMonthTxCount && currentDay <= 20) {
    insights.push({
      icon: "lightning-bolt",
      text: `More transactions than all of last month already`,
      color: COLORS.blue,
      bgColor: COLORS.blue + "12",
    });
  }

  // 17. Micro-spending awareness
  if (debits.length >= 5) {
    const under100 = debits.filter((t) => t.amount < 100).length;
    const microPct = Math.round((under100 / debits.length) * 100);
    if (microPct >= 60) {
      insights.push({
        icon: "cash-minus",
        text: `${microPct}% of transactions are under ₹100 — small spends add up`,
        color: COLORS.darkgray,
        bgColor: COLORS.darkgray + "12",
      });
    }
  }

  // 18. Post-payday surge (1st-5th vs rest)
  if (currentDay >= 10 && debits.length >= 5) {
    const paydaySpend = debits
      .filter((t) => new Date(t.date_time).getDate() <= 5)
      .reduce((a, t) => a + t.amount, 0);
    const paydayDailyAvg = paydaySpend / 5;
    const restSpend = debits
      .filter((t) => new Date(t.date_time).getDate() > 5)
      .reduce((a, t) => a + t.amount, 0);
    const restDays = currentDay - 5;
    const restDailyAvg = restDays > 0 ? restSpend / restDays : 0;
    if (paydayDailyAvg > 0 && restDailyAvg > 0 && paydayDailyAvg > restDailyAvg * 1.5) {
      insights.push({
        icon: "cash-fast",
        text: `You spend ${(paydayDailyAvg / restDailyAvg).toFixed(1)}x more per day in the first 5 days`,
        color: COLORS.peach,
        bgColor: COLORS.peach + "12",
      });
    }
  }

  // 19. Recurring day+category pattern
  if (debits.length >= 7) {
    const dayCatCounts: Record<string, number> = {};
    debits.forEach((t) => {
      const dow = new Date(t.date_time).getDay();
      const key = `${dow}_${t.category_id}`;
      dayCatCounts[key] = (dayCatCounts[key] || 0) + 1;
    });
    const topPattern = Object.entries(dayCatCounts).sort(([, a], [, b]) => b - a)[0];
    if (topPattern && topPattern[1] >= 3) {
      const [dowStr, catIdStr] = topPattern[0].split("_");
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(dowStr)];
      const cat = categoriesById[Number(catIdStr)];
      if (cat) {
        insights.push({
          icon: "calendar-sync",
          text: `Every ${dayName} you spend on ${cat.name}`,
          color: COLORS.purple,
          bgColor: COLORS.purple + "12",
        });
      }
    }
  }

  // 20. Fun equivalence — biggest expense in coffees
  if (debits.length >= 1) {
    const biggest = [...debits].sort((a, b) => b.amount - a.amount)[0];
    const coffeePrice = 200;
    const coffees = Math.floor(biggest.amount / coffeePrice);
    if (coffees >= 3) {
      insights.push({
        icon: "coffee-outline",
        text: `Your biggest expense could buy ${coffees} coffees`,
        color: COLORS.yellow,
        bgColor: COLORS.yellow + "15",
      });
    }
  }

  // 21. Top category multi-month streak
  if (prevMonthTransactions.length > 0) {
    const prevCatTotals: Record<number, number> = {};
    prevMonthTransactions.filter((t) => !t.is_credit).forEach((t) => {
      prevCatTotals[t.category_id] = (prevCatTotals[t.category_id] || 0) + t.amount;
    });
    const prevTopCat = Object.entries(prevCatTotals).sort(([, a], [, b]) => b - a)[0];
    const currTopCat = Object.entries(catSpend).sort(([, a], [, b]) => b - a)[0];
    if (prevTopCat && currTopCat && prevTopCat[0] === currTopCat[0]) {
      const cat = categoriesById[Number(currTopCat[0])];
      if (cat) {
        insights.push({
          icon: "crown-outline",
          text: `${cat.name} is your #1 category for the 2nd month running`,
          color: COLORS.yellow,
          bgColor: COLORS.yellow + "15",
        });
      }
    }
  }

  // 22. Shopping spikes on weekends
  if (debits.length >= 5) {
    const shoppingCat = Object.values(categoriesById).find(
      (c) => c.name.toLowerCase().includes("shopping") && !c.is_deleted,
    );
    if (shoppingCat) {
      const shoppingTxns = debits.filter((t) => t.category_id === shoppingCat.id);
      if (shoppingTxns.length >= 3) {
        const weekendShopping = shoppingTxns.filter((t) => {
          const dow = new Date(t.date_time).getDay();
          return dow === 0 || dow === 6;
        }).length;
        const weekendPct = Math.round((weekendShopping / shoppingTxns.length) * 100);
        if (weekendPct >= 60) {
          insights.push({
            icon: "shopping-outline",
            text: `${weekendPct}% of your shopping happens on weekends`,
            color: COLORS.purple,
            bgColor: COLORS.purple + "12",
          });
        }
      }
    }
  }

  return insights;
};

// ─── Insights display component ───────────────────────────────────
const InsightsSection: React.FC<{
  insights: Insight[];
  COLORS: ColorPalette;
}> = ({ insights, COLORS }) => {
  if (insights.length === 0) return null;

  // Show up to 6 insights
  const shown = insights.slice(0, 6);

  return (
    <View style={{ gap: SIZES.base }}>
      {shown.map((insight, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: insight.bgColor,
            borderRadius: 12,
            paddingHorizontal: SIZES.padding * 0.65,
            paddingVertical: SIZES.base + 3,
            gap: SIZES.base + 2,
          }}
        >
          <Icon name={insight.icon} type="material-community" size={20} color={insight.color} />
          <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "500", color: COLORS.primary, flex: 1 }}>
            {insight.text}
          </Text>
        </View>
      ))}
    </View>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────
const DashboardScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();

  const transactionsById = useExpensifyStore((state) => state.transactions);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const userName = useExpensifyStore((state) => state.userName);
  const monthlyBudget = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance"))?.value || "0",
  );

  const transactions = Object.values(transactionsById);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);

  // Current month data
  const now = new Date();
  const { firstDate, lastDate } = getMonthRange(now.getFullYear(), now.getMonth());
  const currentMonthTransactions = filterTransactions(transactions, {
    startDate: firstDate.toISOString(),
    endDate: lastDate.toISOString(),
  });

  const monthlySpent = currentMonthTransactions.reduce(
    (acc, t) => (t.is_credit ? acc : acc + t.amount),
    0,
  );
  const monthlyIncome = currentMonthTransactions.reduce(
    (acc, t) => (t.is_credit ? acc + t.amount : acc),
    0,
  );

  // Previous month data for comparison
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const { firstDate: prevFirst, lastDate: prevLast } = getMonthRange(prevYear, prevMonth);
  const prevMonthTransactions = filterTransactions(transactions, {
    startDate: prevFirst.toISOString(),
    endDate: prevLast.toISOString(),
  });
  // Only compare up to the same day of month
  const prevMonthSameDay = prevMonthTransactions.filter((t) => {
    return new Date(t.date_time).getDate() <= now.getDate();
  });
  const prevMonthSpent = prevMonthSameDay.reduce(
    (acc, t) => (t.is_credit ? acc : acc + t.amount),
    0,
  );
  const spendingChange = prevMonthSpent > 0
    ? Math.round(((monthlySpent - prevMonthSpent) / prevMonthSpent) * 100)
    : null;

  // Recent transactions (last 3)
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
    .slice(0, 3);

  // Biggest expense this month
  const biggestExpense = currentMonthTransactions
    .filter((t) => !t.is_credit)
    .sort((a, b) => b.amount - a.amount)[0];

  // Upcoming credit card due dates
  const upcomingDues = accounts
    .filter((a) => a.is_credit && a.due_date)
    .map((a) => {
      const dueDate = new Date(a.due_date);
      const daysUntil = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return { ...a, daysUntil };
    })
    .filter((a) => a.daysUntil >= 0 && a.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const transactionCount = currentMonthTransactions.length;
  const firstName = userName ? userName.split(" ")[0] : "";

  // Generate insights
  const insights = useMemo(
    () => generateInsights(currentMonthTransactions, prevMonthTransactions, transactions, categoriesById, monthlyBudget, COLORS),
    [currentMonthTransactions, prevMonthTransactions, transactions, categoriesById, monthlyBudget, COLORS],
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGreeting}>
              Hi{firstName ? `, ${firstName}` : ""}
            </Text>
            <Text style={styles.headerSubtitle}>Here's your month so far</Text>
          </View>
        </View>

        {/* Budget Gauge */}
        {monthlyBudget > 0 && (
          <View style={styles.card}>
            <BudgetGauge spent={monthlySpent} budget={monthlyBudget} COLORS={COLORS} />
          </View>
        )}

        {/* Insight pills row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insightsScroll} contentContainerStyle={styles.insightsContent}>
          {/* Income this month */}
          <View style={[styles.insightPill, { backgroundColor: COLORS.darkgreen + "15" }]}>
            <Icon name="trending-up" type="material-community" size={16} color={COLORS.darkgreen} />
            <Text style={[styles.insightText, { color: COLORS.darkgreen }]}>
              ₹{formatAmountWithCommas(monthlyIncome, false)} earned
            </Text>
          </View>

          {/* Spending vs last month */}
          {spendingChange !== null && (
            <View style={[styles.insightPill, { backgroundColor: spendingChange > 0 ? COLORS.red2 + "15" : COLORS.darkgreen + "15" }]}>
              <Icon
                name={spendingChange > 0 ? "arrow-up" : "arrow-down"}
                type="material-community"
                size={16}
                color={spendingChange > 0 ? COLORS.red2 : COLORS.darkgreen}
              />
              <Text style={[styles.insightText, { color: spendingChange > 0 ? COLORS.red2 : COLORS.darkgreen }]}>
                {Math.abs(spendingChange)}% vs last month
              </Text>
            </View>
          )}

          {/* Transaction count */}
          <View style={[styles.insightPill, { backgroundColor: COLORS.blue + "15" }]}>
            <Icon name="swap-horizontal" type="material-community" size={16} color={COLORS.blue} />
            <Text style={[styles.insightText, { color: COLORS.blue }]}>
              {transactionCount} transaction{transactionCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </ScrollView>

        {/* Spending Heatmap */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending Heatmap</Text>
          <SpendingHeatmap transactions={currentMonthTransactions} COLORS={COLORS} />
        </View>

        {/* Category Breakdown */}
        {currentMonthTransactions.filter((t) => !t.is_credit).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Where it's going</Text>
            <CategoryBars
              transactions={currentMonthTransactions}
              categoriesById={categoriesById}
              COLORS={COLORS}
            />
          </View>
        )}

        {/* Weekend vs Weekday */}
        {currentMonthTransactions.filter((t) => !t.is_credit).length >= 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weekend vs Weekday</Text>
            <WeekendVsWeekday transactions={currentMonthTransactions} COLORS={COLORS} />
          </View>
        )}

        {/* Account Usage */}
        {currentMonthTransactions.filter((t) => !t.is_credit).length >= 2 && accounts.length >= 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Activity</Text>
            <AccountUsageDonut transactions={currentMonthTransactions} accountsById={accountsById} COLORS={COLORS} />
          </View>
        )}

        {/* Smart Insights */}
        {insights.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Insights</Text>
            <InsightsSection insights={insights} COLORS={COLORS} />
          </View>
        )}

        {/* Insight callout cards */}
        <View style={styles.insightCardsRow}>
          {/* Biggest expense */}
          {biggestExpense && (
            <View style={[styles.insightCard, { backgroundColor: COLORS.peach + "12" }]}>
              <Icon name="trophy-outline" type="material-community" size={22} color={COLORS.peach} />
              <Text style={[styles.insightCardLabel, { color: COLORS.darkgray }]}>Biggest expense</Text>
              <Text style={[styles.insightCardValue, { color: COLORS.primary }]} numberOfLines={1}>
                {biggestExpense.description || "—"}
              </Text>
              <Text style={[styles.insightCardAmount, { color: COLORS.red2 }]}>
                ₹{formatAmountWithCommas(biggestExpense.amount, false)}
              </Text>
            </View>
          )}

          {/* Upcoming due */}
          {upcomingDues.length > 0 ? (
            <View style={[styles.insightCard, { backgroundColor: upcomingDues[0].daysUntil <= 3 ? COLORS.red2 + "12" : COLORS.yellow + "15" }]}>
              <Icon name="calendar-clock" type="material-community" size={22} color={upcomingDues[0].daysUntil <= 3 ? COLORS.red2 : COLORS.yellow} />
              <Text style={[styles.insightCardLabel, { color: COLORS.darkgray }]}>Next due</Text>
              <Text style={[styles.insightCardValue, { color: COLORS.primary }]} numberOfLines={1}>
                {upcomingDues[0].name}
              </Text>
              <Text style={[styles.insightCardAmount, { color: upcomingDues[0].daysUntil <= 3 ? COLORS.red2 : COLORS.primary }]}>
                {upcomingDues[0].daysUntil === 0 ? "Today" : `${upcomingDues[0].daysUntil}d left`}
              </Text>
            </View>
          ) : !biggestExpense ? null : (
            <View style={[styles.insightCard, { backgroundColor: COLORS.darkgreen + "12" }]}>
              <Icon name="check-circle-outline" type="material-community" size={22} color={COLORS.darkgreen} />
              <Text style={[styles.insightCardLabel, { color: COLORS.darkgray }]}>Dues</Text>
              <Text style={[styles.insightCardValue, { color: COLORS.darkgreen }]}>All clear</Text>
              <Text style={[styles.insightCardAmount, { color: COLORS.darkgreen }]}>No upcoming</Text>
            </View>
          )}
        </View>

        {/* Accounts */}
        {accounts.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Accounts</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Banks")}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <View>
              {accounts.map((account, i) => (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.accountRow, i < accounts.length - 1 && styles.accountRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate("AddBank", { account, mode: "edit" })}
                >
                  <View style={[styles.accountRowIcon, { backgroundColor: account.is_credit ? COLORS.purple + "12" : COLORS.blue + "12" }]}>
                    <Icon
                      name={account.is_credit ? "credit-card-outline" : "wallet-outline"}
                      type="material-community"
                      size={16}
                      color={account.is_credit ? COLORS.purple : COLORS.blue}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountRowName} numberOfLines={1}>{account.name}</Text>
                    <Text style={styles.accountRowType}>{account.is_credit ? "Credit" : "Debit"}</Text>
                  </View>
                  <Text style={[styles.accountRowBalance, { color: account.amount >= 0 ? COLORS.primary : COLORS.red2 }]}>
                    ₹{formatAmountWithCommas(Math.abs(account.amount), false)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Recent</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Transactions")}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <View>
              {recentTransactions.map((transaction) => (
                <TouchableOpacity
                  key={transaction.id}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate("TransactionEdit", { transaction, mode: "edit" })}
                >
                  <TransactionCard item={transaction} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {transactions.length === 0 && accounts.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="rocket-launch-outline" type="material-community" size={48} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>Get Started</Text>
            <Text style={styles.emptyText}>Add an account and your first transaction</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <CustomFAB />
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.white,
    },
    scrollContent: {
      paddingHorizontal: SIZES.padding,
    },

    // Header
    header: {
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerGreeting: {
      ...FONTS.h1,
      color: COLORS.primary,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      ...FONTS.body3,
      color: COLORS.darkgray,
      marginTop: 2,
    },

    // Cards
    card: {
      backgroundColor: COLORS.lightGray,
      borderRadius: 16,
      padding: SIZES.padding,
      marginBottom: SIZES.base + 4,
    },
    cardTitle: {
      ...FONTS.h3,
      fontWeight: "700",
      color: COLORS.primary,
      letterSpacing: -0.2,
      marginBottom: SIZES.base + 4,
    },
    cardTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    // Insight pills
    insightsScroll: {
      marginBottom: SIZES.base + 4,
    },
    insightsContent: {
      gap: SIZES.base,
    },
    insightPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    insightText: {
      ...FONTS.body4,
      fontSize: 13,
      fontWeight: "600",
    },

    // Insight callout cards
    insightCardsRow: {
      flexDirection: "row",
      gap: SIZES.base + 4,
      marginBottom: SIZES.base + 4,
    },
    insightCard: {
      flex: 1,
      borderRadius: 14,
      padding: SIZES.padding * 0.7,
      gap: 4,
    },
    insightCardLabel: {
      ...FONTS.body4,
      fontSize: 11,
      marginTop: 4,
    },
    insightCardValue: {
      ...FONTS.body3,
      fontWeight: "600",
    },
    insightCardAmount: {
      ...FONTS.body4,
      fontWeight: "700",
      fontSize: 15,
    },

    // Accounts
    seeAllText: {
      ...FONTS.body4,
      color: COLORS.darkgray,
    },
    accountRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SIZES.base + 4,
      gap: SIZES.base + 2,
    },
    accountRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.gray + "40",
    },
    accountRowIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    accountRowName: {
      ...FONTS.body3,
      fontWeight: "500",
      color: COLORS.primary,
    },
    accountRowType: {
      ...FONTS.body4,
      fontSize: 11,
      color: COLORS.darkgray,
      marginTop: 1,
    },
    accountRowBalance: {
      ...FONTS.body3,
      fontWeight: "600",
    },


    // Empty state
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: SIZES.padding * 4,
      gap: SIZES.base,
    },
    emptyTitle: {
      ...FONTS.h2,
      color: COLORS.primary,
      fontWeight: "700",
    },
    emptyText: {
      ...FONTS.body3,
      color: COLORS.darkgray,
    },
  });

export default DashboardScreen;
