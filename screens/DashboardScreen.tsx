import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  Animated,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

// ─── Spending Heatmap ─────────────────────────────────────────────
const SpendingHeatmap: React.FC<{
  transactions: Transaction[];
  COLORS: ColorPalette;
}> = ({ transactions, COLORS }) => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();

  const dailySpend: number[] = new Array(daysInMonth).fill(0);
  transactions.forEach((t) => {
    if (!t.is_credit) {
      const day = new Date(t.date_time).getDate();
      if (day >= 1 && day <= daysInMonth) dailySpend[day - 1] += t.amount;
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

  const cols = 7;
  const gap = 4;
  const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const containerWidth = SCREEN_WIDTH - SIZES.padding * 2 - SIZES.padding * 1.4;
  const cellSize = (containerWidth - (cols - 1) * gap) / cols;
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const cells: Array<{ day: number; amount: number } | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 0; d < daysInMonth; d++) cells.push({ day: d + 1, amount: dailySpend[d] });
  while (cells.length % cols !== 0) cells.push(null);

  const noSpendDays = dailySpend.slice(0, currentDay).filter((v) => v === 0).length;

  const rows: Array<Array<{ day: number; amount: number } | null>> = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {dayLabels.map((label, i) => (
          <View key={i} style={{ width: cellSize, marginRight: i < cols - 1 ? gap : 0, alignItems: "center" }}>
            <Text style={{ ...FONTS.body4, fontSize: 10, color: COLORS.darkgray }}>{label}</Text>
          </View>
        ))}
      </View>
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
  categoryBudgets: Record<number, import("../types/entity/CategoryBudget").CategoryBudget>;
  COLORS: ColorPalette;
}> = ({ transactions, categoriesById, categoryBudgets, COLORS }) => {
  const spending: Record<number, number> = {};
  transactions
    .filter((t) => !t.is_credit)
    .forEach((t) => { spending[t.category_id] = (spending[t.category_id] || 0) + t.amount; });

  const sorted = Object.entries(spending).sort(([, a], [, b]) => b - a).slice(0, 5);
  const maxAmount = sorted[0] ? sorted[0][1] : 1;

  return (
    <View style={{ gap: SIZES.base + 4 }}>
      {sorted.map(([catId, amount], index) => {
        const category = categoriesById[Number(catId)];
        if (!category) return null;
        const budget = categoryBudgets[Number(catId)];
        const hasBudget = budget && budget.amount > 0;
        const budgetPct = hasBudget ? Math.min(amount / budget.amount, 1) : 0;
        const barWidth = hasBudget ? budgetPct * 100 : (amount / maxAmount) * 100;
        const isOver = hasBudget && amount > budget.amount;
        const color = hasBudget
          ? (isOver ? COLORS.red2 : budgetPct > 0.8 ? COLORS.yellow : COLORS.darkgreen)
          : PRETTYCOLORS[index % PRETTYCOLORS.length];

        return (
          <View key={catId} style={{ flexDirection: "row", alignItems: "center", gap: SIZES.base }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + "20", justifyContent: "center", alignItems: "center" }}>
              <Icon name={category.icon_name} type={category.icon_type} size={16} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "500", color: COLORS.primary }}>{category.name}</Text>
                <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "600", color: isOver ? COLORS.red2 : COLORS.primary }}>
                  {hasBudget
                    ? `₹${formatAmountWithCommas(amount, false)} / ${formatAmountWithCommas(budget.amount, false)}`
                    : `₹${formatAmountWithCommas(amount, false)}`}
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: COLORS.lightGray2, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: 6, width: `${Math.min(barWidth, 100)}%`, backgroundColor: color, borderRadius: 3 }} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─── Weekend vs Weekday ───────────────────────────────────────────
const WeekendVsWeekday: React.FC<{
  transactions: Transaction[];
  COLORS: ColorPalette;
}> = ({ transactions, COLORS }) => {
  const debits = transactions.filter((t) => !t.is_credit);
  if (debits.length < 3) return null;

  let weekdayTotal = 0, weekendTotal = 0, weekdayCount = 0, weekendCount = 0;
  debits.forEach((t) => {
    const dow = new Date(t.date_time).getDay();
    if (dow === 0 || dow === 6) { weekendTotal += t.amount; weekendCount++; }
    else { weekdayTotal += t.amount; weekdayCount++; }
  });

  const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
  const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;
  const maxAvg = Math.max(weekdayAvg, weekendAvg, 1);

  return (
    <View style={{ gap: SIZES.base + 2 }}>
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "500", color: COLORS.primary }}>Weekdays</Text>
          <Text style={{ ...FONTS.body4, fontSize: 12, color: COLORS.darkgray }}>avg ₹{formatAmountWithCommas(weekdayAvg, false)}/txn</Text>
        </View>
        <View style={{ height: 8, backgroundColor: COLORS.lightGray2, borderRadius: 4, overflow: "hidden" }}>
          <View style={{ height: 8, width: `${(weekdayAvg / maxAvg) * 100}%`, backgroundColor: COLORS.blue, borderRadius: 4 }} />
        </View>
      </View>
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ ...FONTS.body4, fontSize: 13, fontWeight: "500", color: COLORS.primary }}>Weekends</Text>
          <Text style={{ ...FONTS.body4, fontSize: 12, color: COLORS.darkgray }}>avg ₹{formatAmountWithCommas(weekendAvg, false)}/txn</Text>
        </View>
        <View style={{ height: 8, backgroundColor: COLORS.lightGray2, borderRadius: 4, overflow: "hidden" }}>
          <View style={{ height: 8, width: `${(weekendAvg / maxAvg) * 100}%`, backgroundColor: COLORS.purple, borderRadius: 4 }} />
        </View>
      </View>
      {weekendAvg > 0 && weekdayAvg > 0 && (
        <Text style={{ ...FONTS.body4, fontSize: 11, color: COLORS.darkgray, marginTop: 2 }}>
          {weekendAvg > weekdayAvg
            ? `Weekend transactions are ${(weekendAvg / weekdayAvg).toFixed(1)}x larger on average`
            : `Weekday transactions are ${(weekdayAvg / weekendAvg).toFixed(1)}x larger on average`}
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

  const usage: Record<number, number> = {};
  debits.forEach((t) => { usage[t.account_id] = (usage[t.account_id] || 0) + 1; });

  const sorted = Object.entries(usage).sort(([, a], [, b]) => b - a).slice(0, 5);
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
      <View style={{ flex: 1, gap: 4 }}>
        {sorted.map(([accId, count], i) => {
          const account = accountsById[Number(accId)];
          if (!account) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <View key={accId} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: donutColors[i % donutColors.length] }} />
              <Text style={{ ...FONTS.body4, fontSize: 12, color: COLORS.primary, flex: 1 }} numberOfLines={1}>{account.name}</Text>
              <Text style={{ ...FONTS.body4, fontSize: 12, fontWeight: "600", color: COLORS.darkgray }}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ─── Insights engine ──────────────────────────────────────────────
type InsightBucket = "warning" | "pattern" | "fun" | "milestone";

interface Insight {
  icon: string;
  text: string;
  color: string;
  bgColor: string;
  bucket: InsightBucket;
}

const generateInsights = (
  currentMonthTransactions: Transaction[],
  prevMonthTransactions: Transaction[],
  allTransactions: Transaction[],
  categoriesById: Record<number, Category>,
  categoryBudgets: Record<number, import("../types/entity/CategoryBudget").CategoryBudget>,
  monthlyBudget: number,
  COLORS: ColorPalette,
): Insight[] => {
  const insights: Insight[] = [];
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const debits = currentMonthTransactions.filter((t) => !t.is_credit);

  if (debits.length === 0) return [];

  const totalSpent = debits.reduce((acc, t) => acc + t.amount, 0);

  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  debits.forEach((t) => { const dow = new Date(t.date_time).getDay(); dayTotals[dow] += t.amount; });
  const dayNames = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const maxDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
  if (dayTotals[maxDayIdx] > 0 && debits.length >= 3) {
    insights.push({ icon: "calendar-week", text: `You spend the most on ${dayNames[maxDayIdx]}`, color: COLORS.purple, bgColor: COLORS.purple + "12", bucket: "pattern" });
  }

  const daySpend: Record<number, number> = {};
  debits.forEach((t) => { const d = new Date(t.date_time).getDate(); daySpend[d] = (daySpend[d] || 0) + t.amount; });
  const peakDay = Object.entries(daySpend).sort(([, a], [, b]) => b - a)[0];
  if (peakDay && debits.length >= 3) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    insights.push({ icon: "chart-bar", text: `${months[now.getMonth()]} ${peakDay[0]} was your biggest day: ₹${formatAmountWithCommas(Number(peakDay[1]), false)}`, color: COLORS.peach, bgColor: COLORS.peach + "12", bucket: "pattern" });
  }

  const descCounts: Record<string, number> = {};
  debits.forEach((t) => { const desc = (t.description || "").trim(); if (desc) descCounts[desc] = (descCounts[desc] || 0) + 1; });
  const topDesc = Object.entries(descCounts).sort(([, a], [, b]) => b - a)[0];
  if (topDesc && topDesc[1] >= 2) {
    insights.push({ icon: "repeat", text: `${topDesc[0]} appears ${topDesc[1]} times this month`, color: COLORS.blue, bgColor: COLORS.blue + "12", bucket: "pattern" });
  }

  if (debits.length >= 2) {
    const avg = totalSpent / debits.length;
    insights.push({ icon: "calculator-variant-outline", text: `Your average expense is ₹${formatAmountWithCommas(avg, false)}`, color: COLORS.lightBlue, bgColor: COLORS.lightBlue + "15", bucket: "fun" });
  }

  if (debits.length >= 5) {
    const median = [...debits].sort((a, b) => a.amount - b.amount)[Math.floor(debits.length / 2)].amount;
    const smallCount = debits.filter((t) => t.amount < median).length;
    const pct = Math.round((smallCount / debits.length) * 100);
    insights.push({ icon: "scale-balance", text: `${pct}% of your transactions are under ₹${formatAmountWithCommas(median, false)}`, color: COLORS.darkgray, bgColor: COLORS.darkgray + "12", bucket: "fun" });
  }

  const catSpend: Record<number, number> = {};
  debits.forEach((t) => { catSpend[t.category_id] = (catSpend[t.category_id] || 0) + t.amount; });
  const prevDebits = prevMonthTransactions.filter((t) => !t.is_credit && new Date(t.date_time).getDate() <= currentDay);
  const prevCatSpend: Record<number, number> = {};
  prevDebits.forEach((t) => { prevCatSpend[t.category_id] = (prevCatSpend[t.category_id] || 0) + t.amount; });

  let biggestIncreaseCat: { id: number; pct: number } | null = null;
  let biggestDecreaseCat: { id: number; pct: number } | null = null;
  for (const [catId, amount] of Object.entries(catSpend)) {
    const prev = prevCatSpend[Number(catId)] || 0;
    if (prev > 0) {
      const change = Math.round(((amount - prev) / prev) * 100);
      if (change > 20 && (!biggestIncreaseCat || change > biggestIncreaseCat.pct)) biggestIncreaseCat = { id: Number(catId), pct: change };
      if (change < -20 && (!biggestDecreaseCat || change < biggestDecreaseCat.pct)) biggestDecreaseCat = { id: Number(catId), pct: change };
    }
  }
  if (biggestIncreaseCat && categoriesById[biggestIncreaseCat.id]) {
    insights.push({ icon: "trending-up", text: `${categoriesById[biggestIncreaseCat.id].name} is up ${biggestIncreaseCat.pct}% vs last month`, color: COLORS.red2, bgColor: COLORS.red2 + "12", bucket: "pattern" });
  }
  if (biggestDecreaseCat && categoriesById[biggestDecreaseCat.id]) {
    insights.push({ icon: "trending-down", text: `${categoriesById[biggestDecreaseCat.id].name} is down ${Math.abs(biggestDecreaseCat.pct)}% vs last month`, color: COLORS.darkgreen, bgColor: COLORS.darkgreen + "12", bucket: "pattern" });
  }

  if (currentDay >= 5 && monthlyBudget > 0) {
    const projected = Math.round((totalSpent / currentDay) * daysInMonth);
    if (projected > monthlyBudget * 1.1) {
      insights.push({ icon: "alert-circle-outline", text: `At this pace you'll spend ₹${formatAmountWithCommas(projected, false)} by month end`, color: COLORS.red2, bgColor: COLORS.red2 + "12", bucket: "warning" });
    } else if (projected < monthlyBudget * 0.8) {
      insights.push({ icon: "party-popper", text: `On track to finish under budget at ₹${formatAmountWithCommas(projected, false)}`, color: COLORS.darkgreen, bgColor: COLORS.darkgreen + "12", bucket: "milestone" });
    }
  }

  const prevMonthTotal = prevMonthTransactions.filter((t) => !t.is_credit).reduce((a, t) => a + t.amount, 0);
  if (prevMonthTotal > 0 && totalSpent > prevMonthTotal) {
    insights.push({ icon: "alert-outline", text: `You've already spent more than all of last month`, color: COLORS.red2, bgColor: COLORS.red2 + "12", bucket: "warning" });
  }

  if (currentDay > 16 && debits.length >= 5) {
    const firstHalf = debits.filter((t) => new Date(t.date_time).getDate() <= 15).reduce((a, t) => a + t.amount, 0);
    const secondHalf = debits.filter((t) => new Date(t.date_time).getDate() > 15).reduce((a, t) => a + t.amount, 0);
    if (firstHalf > 0 && secondHalf > 0) {
      insights.push({ icon: "calendar-range", text: `You spend more in the ${firstHalf > secondHalf ? "first" : "second"} half of the month`, color: COLORS.purple, bgColor: COLORS.purple + "12", bucket: "pattern" });
    }
  }

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
      insights.push({ icon: info.icon, text: `You're a ${info.label} spender — most spending happens then`, color: info.color, bgColor: info.color + "15", bucket: "pattern" });
    }
  }

  if (debits.length >= 4) {
    let weekdayTotal = 0, weekendTotal = 0, weekdayDays = 0, weekendDays = 0;
    for (let d = 1; d <= currentDay; d++) {
      const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
      if (dow === 0 || dow === 6) weekendDays++; else weekdayDays++;
    }
    debits.forEach((t) => {
      const dow = new Date(t.date_time).getDay();
      if (dow === 0 || dow === 6) weekendTotal += t.amount; else weekdayTotal += t.amount;
    });
    const weekdayDailyAvg = weekdayDays > 0 ? weekdayTotal / weekdayDays : 0;
    const weekendDailyAvg = weekendDays > 0 ? weekendTotal / weekendDays : 0;
    if (weekdayDailyAvg > 0 && weekendDailyAvg > 0) {
      const ratio = weekendDailyAvg / weekdayDailyAvg;
      if (ratio > 1.3) insights.push({ icon: "beach", text: `You spend ${ratio.toFixed(1)}x more per day on weekends`, color: COLORS.peach, bgColor: COLORS.peach + "12", bucket: "pattern" });
      else if (ratio < 0.7) insights.push({ icon: "briefcase-outline", text: `Weekdays cost you ${(1 / ratio).toFixed(1)}x more per day than weekends`, color: COLORS.blue, bgColor: COLORS.blue + "12", bucket: "pattern" });
    }
  }

  if (Object.keys(catSpend).length >= 2 && debits.length >= 3) {
    const sortedCats = Object.values(catSpend).sort((a, b) => b - a);
    const top2 = sortedCats.slice(0, 2).reduce((a, b) => a + b, 0);
    const concentrationPct = Math.round((top2 / totalSpent) * 100);
    const numCategories = Object.keys(catSpend).length;
    if (concentrationPct > 75) {
      insights.push({ icon: "target", text: `${concentrationPct}% of spending is in just 2 categories`, color: COLORS.peach, bgColor: COLORS.peach + "12", bucket: "fun" });
    } else if (numCategories >= 5) {
      insights.push({ icon: "shape-outline", text: `You spread spending across ${numCategories} categories`, color: COLORS.darkgreen, bgColor: COLORS.darkgreen + "12", bucket: "fun" });
    }
  }

  const budgetEntries = Object.entries(categoryBudgets);
  if (budgetEntries.length > 0 && debits.length > 0) {
    const daysRemaining = daysInMonth - currentDay;
    let overBudgetCount = 0, underBudgetCount = 0;
    for (const [catIdStr, budget] of budgetEntries) {
      const catId = Number(catIdStr);
      const spent = catSpend[catId] || 0;
      const pct = budget.amount > 0 ? spent / budget.amount : 0;
      const catName = categoriesById[catId]?.name;
      if (!catName) continue;
      if (pct > 1) {
        overBudgetCount++;
        if (overBudgetCount === 1) insights.push({ icon: "alert-circle-outline", text: `${catName} is over budget by ₹${formatAmountWithCommas(spent - budget.amount, false)}`, color: COLORS.red2, bgColor: COLORS.red2 + "12", bucket: "warning" });
      } else if (pct >= 0.8 && daysRemaining > 0) {
        insights.push({ icon: "speedometer", text: `${Math.round(pct * 100)}% through ${catName} budget with ${daysRemaining} days left`, color: COLORS.yellow, bgColor: COLORS.yellow + "15", bucket: "warning" });
      } else { underBudgetCount++; }
    }
    if (budgetEntries.length >= 2) {
      if (underBudgetCount === budgetEntries.length) {
        insights.push({ icon: "check-decagram", text: `All ${budgetEntries.length} tracked categories are under budget`, color: COLORS.darkgreen, bgColor: COLORS.darkgreen + "12", bucket: "milestone" });
      } else if (underBudgetCount > 0 && overBudgetCount > 0) {
        insights.push({ icon: "chart-box-outline", text: `${underBudgetCount} of ${budgetEntries.length} tracked categories under budget`, color: COLORS.blue, bgColor: COLORS.blue + "12", bucket: "fun" });
      }
    }
  }

  let logStreak = 0;
  for (let d = currentDay; d >= 1; d--) {
    if (currentMonthTransactions.some((t) => new Date(t.date_time).getDate() === d)) logStreak++;
    else break;
  }
  if (logStreak >= 3) insights.push({ icon: "fire", text: `${logStreak} day logging streak — keep it up!`, color: COLORS.peach, bgColor: COLORS.peach + "12", bucket: "milestone" });

  const milestones = [500, 250, 100, 50];
  for (const milestone of milestones) {
    if (allTransactions.length >= milestone) {
      insights.push({ icon: "trophy-outline", text: `You've tracked ${allTransactions.length} transactions — nice!`, color: COLORS.yellow, bgColor: COLORS.yellow + "18", bucket: "milestone" });
      break;
    }
  }

  if (currentDay >= 14 && debits.length >= 5) {
    const fullWeeks = Math.floor(currentDay / 7);
    const weekTotals: number[] = [];
    for (let w = 0; w < fullWeeks; w++) {
      const weekStart = w * 7 + 1;
      const weekEnd = weekStart + 6;
      weekTotals.push(debits.filter((t) => { const d = new Date(t.date_time).getDate(); return d >= weekStart && d <= weekEnd; }).reduce((a, t) => a + t.amount, 0));
    }
    if (weekTotals.length >= 2 && weekTotals.indexOf(Math.min(...weekTotals)) === fullWeeks - 1) {
      insights.push({ icon: "star-outline", text: `This is your lowest spending week so far this month`, color: COLORS.darkgreen, bgColor: COLORS.darkgreen + "12", bucket: "milestone" });
    }
  }

  if (prevMonthTransactions.length > 0 && currentMonthTransactions.length > prevMonthTransactions.length && currentDay <= 20) {
    insights.push({ icon: "lightning-bolt", text: `More transactions than all of last month already`, color: COLORS.blue, bgColor: COLORS.blue + "12", bucket: "milestone" });
  }

  if (debits.length >= 5) {
    const under100 = debits.filter((t) => t.amount < 100).length;
    const microPct = Math.round((under100 / debits.length) * 100);
    if (microPct >= 60) insights.push({ icon: "cash-minus", text: `${microPct}% of transactions are under ₹100 — small spends add up`, color: COLORS.darkgray, bgColor: COLORS.darkgray + "12", bucket: "fun" });
  }

  if (currentDay >= 10 && debits.length >= 5) {
    const paydaySpend = debits.filter((t) => new Date(t.date_time).getDate() <= 5).reduce((a, t) => a + t.amount, 0);
    const paydayDailyAvg = paydaySpend / 5;
    const restDays = currentDay - 5;
    const restDailyAvg = restDays > 0 ? debits.filter((t) => new Date(t.date_time).getDate() > 5).reduce((a, t) => a + t.amount, 0) / restDays : 0;
    if (paydayDailyAvg > 0 && restDailyAvg > 0 && paydayDailyAvg > restDailyAvg * 1.5) {
      insights.push({ icon: "cash-fast", text: `You spend ${(paydayDailyAvg / restDailyAvg).toFixed(1)}x more per day in the first 5 days`, color: COLORS.peach, bgColor: COLORS.peach + "12", bucket: "warning" });
    }
  }

  if (debits.length >= 7) {
    const dayCatCounts: Record<string, number> = {};
    debits.forEach((t) => { const key = `${new Date(t.date_time).getDay()}_${t.category_id}`; dayCatCounts[key] = (dayCatCounts[key] || 0) + 1; });
    const topPattern = Object.entries(dayCatCounts).sort(([, a], [, b]) => b - a)[0];
    if (topPattern && topPattern[1] >= 3) {
      const [dowStr, catIdStr] = topPattern[0].split("_");
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(dowStr)];
      const cat = categoriesById[Number(catIdStr)];
      if (cat) insights.push({ icon: "calendar-sync", text: `Every ${dayName} you spend on ${cat.name}`, color: COLORS.purple, bgColor: COLORS.purple + "12", bucket: "pattern" });
    }
  }

  if (debits.length >= 1) {
    const biggest = [...debits].sort((a, b) => b.amount - a.amount)[0];
    const coffees = Math.floor(biggest.amount / 200);
    if (coffees >= 3) insights.push({ icon: "coffee-outline", text: `Your biggest expense could buy ${coffees} coffees`, color: COLORS.yellow, bgColor: COLORS.yellow + "15", bucket: "fun" });
  }

  if (prevMonthTransactions.length > 0) {
    const prevCatTotals: Record<number, number> = {};
    prevMonthTransactions.filter((t) => !t.is_credit).forEach((t) => { prevCatTotals[t.category_id] = (prevCatTotals[t.category_id] || 0) + t.amount; });
    const prevTopCat = Object.entries(prevCatTotals).sort(([, a], [, b]) => b - a)[0];
    const currTopCat = Object.entries(catSpend).sort(([, a], [, b]) => b - a)[0];
    if (prevTopCat && currTopCat && prevTopCat[0] === currTopCat[0]) {
      const cat = categoriesById[Number(currTopCat[0])];
      if (cat) insights.push({ icon: "crown-outline", text: `${cat.name} is your #1 category for the 2nd month running`, color: COLORS.yellow, bgColor: COLORS.yellow + "15", bucket: "milestone" });
    }
  }

  if (debits.length >= 5) {
    const shoppingCat = Object.values(categoriesById).find((c) => c.name.toLowerCase().includes("shopping") && !c.is_deleted);
    if (shoppingCat) {
      const shoppingTxns = debits.filter((t) => t.category_id === shoppingCat.id);
      if (shoppingTxns.length >= 3) {
        const weekendPct = Math.round((shoppingTxns.filter((t) => { const dow = new Date(t.date_time).getDay(); return dow === 0 || dow === 6; }).length / shoppingTxns.length) * 100);
        if (weekendPct >= 60) insights.push({ icon: "shopping-outline", text: `${weekendPct}% of your shopping happens on weekends`, color: COLORS.purple, bgColor: COLORS.purple + "12", bucket: "pattern" });
      }
    }
  }

  return insights;
};

const pickRandomFromBuckets = (insights: Insight[], maxTotal: number): Insight[] => {
  const buckets: Record<InsightBucket, Insight[]> = { warning: [], pattern: [], fun: [], milestone: [] };
  insights.forEach((i) => buckets[i.bucket].push(i));

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const result: Insight[] = [];
  result.push(...shuffle(buckets.warning).slice(0, 1));
  result.push(...shuffle(buckets.pattern).slice(0, 2));
  result.push(...shuffle(buckets.fun).slice(0, 1));
  result.push(...shuffle(buckets.milestone).slice(0, 1));

  if (result.length < maxTotal) {
    const usedTexts = new Set(result.map((r) => r.text));
    result.push(...shuffle(insights.filter((i) => !usedTexts.has(i.text))).slice(0, maxTotal - result.length));
  }

  return result.slice(0, maxTotal);
};

// ─── Tab type ─────────────────────────────────────────────────────
type ChartTab = "heatmap" | "spend" | "patterns";

// ─── Main Dashboard ───────────────────────────────────────────────
const DashboardScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<ChartTab>("heatmap");

  const isDark = COLORS.white === "#121212";
  const heroBg = isDark ? "#1A2535" : COLORS.primary;
  const heroTextPrimary = "#FFFFFF";
  const heroTextSecondary = isDark ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.65)";

  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  // SCROLL_DISTANCE = 198 regardless of device (insets.top cancels out)
  // HERO_MAX = insets.top + 270  →  HERO_MIN = insets.top + 72  →  diff = 198
  const SCROLL_DISTANCE = 198;
  const HERO_MAX_HEIGHT = insets.top + 270;
  const HERO_MIN_HEIGHT = insets.top + 72;

  // Created once — dependencies are stable after the first render
  const heroHeight = useMemo(
    () => scrollY.interpolate({
      inputRange: [0, SCROLL_DISTANCE],
      outputRange: [HERO_MAX_HEIGHT, HERO_MIN_HEIGHT],
      extrapolate: "clamp",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollY, HERO_MAX_HEIGHT, HERO_MIN_HEIGHT],
  );

  const heroBorderRadius = useMemo(
    () => scrollY.interpolate({
      inputRange: [SCROLL_DISTANCE * 0.6, SCROLL_DISTANCE],
      outputRange: [32, 0],
      extrapolate: "clamp",
    }),
    [scrollY],
  );

  // Crossfade: full starts fading at 30%, mini starts appearing at 40%
  // Overlap window (30-65%) means something is always visible — no dead zone
  const fullContentOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [0, SCROLL_DISTANCE * 0.3, SCROLL_DISTANCE * 0.65],
      outputRange: [1, 0.55, 0],
      extrapolate: "clamp",
    }),
    [scrollY],
  );

  const miniContentOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [SCROLL_DISTANCE * 0.4, SCROLL_DISTANCE * 0.7, SCROLL_DISTANCE],
      outputRange: [0, 0.55, 1],
      extrapolate: "clamp",
    }),
    [scrollY],
  );

  const transactionsById = useExpensifyStore((state) => state.transactions);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const userName = useExpensifyStore((state) => state.userName);
  const categoryBudgets = useExpensifyStore((state) => state.categoryBudgets);
  const monthlyBudget = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance"))?.value || "0",
  );

  const transactions = Object.values(transactionsById);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);

  const now = new Date();
  const { firstDate, lastDate } = getMonthRange(now.getFullYear(), now.getMonth());
  const currentMonthTransactions = filterTransactions(transactions, {
    startDate: firstDate.toISOString(),
    endDate: lastDate.toISOString(),
  });

  const monthlySpent = currentMonthTransactions.reduce((acc, t) => (t.is_credit ? acc : acc + t.amount), 0);
  const monthlyIncome = currentMonthTransactions.reduce((acc, t) => (t.is_credit ? acc + t.amount : acc), 0);

  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const { firstDate: prevFirst, lastDate: prevLast } = getMonthRange(prevYear, prevMonth);
  const prevMonthTransactions = filterTransactions(transactions, {
    startDate: prevFirst.toISOString(),
    endDate: prevLast.toISOString(),
  });
  const prevMonthSpent = prevMonthTransactions
    .filter((t) => !t.is_credit && new Date(t.date_time).getDate() <= now.getDate())
    .reduce((acc, t) => acc + t.amount, 0);
  const spendingChange = prevMonthSpent > 0
    ? Math.round(((monthlySpent - prevMonthSpent) / prevMonthSpent) * 100)
    : null;

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
    .slice(0, 3);

  const biggestExpense = currentMonthTransactions
    .filter((t) => !t.is_credit)
    .sort((a, b) => b.amount - a.amount)[0];

  const upcomingDues = accounts
    .filter((a) => a.is_credit && a.due_date)
    .map((a) => {
      const daysUntil = Math.ceil((new Date(a.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...a, daysUntil };
    })
    .filter((a) => a.daysUntil >= 0 && a.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const transactionCount = currentMonthTransactions.length;
  const firstName = userName ? userName.split(" ")[0] : "";

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg = monthlySpent / Math.max(now.getDate(), 1);
  const idealDaily = monthlyBudget > 0 ? monthlyBudget / daysInMonth : 0;
  const budgetProgress = monthlyBudget > 0 ? Math.min(monthlySpent / monthlyBudget, 1) : 0;
  const budgetBarColor = budgetProgress > 0.9 ? COLORS.red2 : budgetProgress > 0.7 ? COLORS.yellow : "#4ADE80";

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = MONTH_NAMES[now.getMonth()];

  const insights = useMemo(
    () => generateInsights(currentMonthTransactions, prevMonthTransactions, transactions, categoriesById, categoryBudgets, monthlyBudget, COLORS),
    [currentMonthTransactions, prevMonthTransactions, transactions, categoriesById, categoryBudgets, monthlyBudget, COLORS],
  );
  const shownInsights = useMemo(() => pickRandomFromBuckets(insights, 5), [insights]);

  const hasDebits = currentMonthTransactions.filter((t) => !t.is_credit).length > 0;
  const hasWeekendData = currentMonthTransactions.filter((t) => !t.is_credit).length >= 3;
  const hasDonutData = currentMonthTransactions.filter((t) => !t.is_credit).length >= 2 && accounts.length >= 2;

  return (
    <View style={styles.container}>

      {/* ── Scrollable content (hero excluded — lives above) ──────── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        // paddingTop = heroMaxHeight so content starts exactly below the hero
        contentContainerStyle={[styles.scrollContent, { paddingTop: HERO_MAX_HEIGHT + SIZES.base + 4 }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }, // JS driver needed for height/borderRadius
        )}
        scrollEventThrottle={16}
      >
        {/* ── Tabbed Chart Card ─────────────────────────────────── */}
        {currentMonthTransactions.length > 0 && (
          <View style={styles.card}>
            <View style={[styles.tabStrip, { backgroundColor: COLORS.lightGray2 }]}>
              {(["heatmap", "spend", "patterns"] as ChartTab[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabItem, activeTab === tab && [styles.tabItemActive, { backgroundColor: COLORS.white }]]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, { color: activeTab === tab ? COLORS.primary : COLORS.darkgray, fontWeight: activeTab === tab ? "600" : "500" }]}>
                    {tab === "heatmap" ? "Heatmap" : tab === "spend" ? "Spend" : "Patterns"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === "heatmap" && (
              <SpendingHeatmap transactions={currentMonthTransactions} COLORS={COLORS} />
            )}
            {activeTab === "spend" && hasDebits && (
              <CategoryBars
                transactions={currentMonthTransactions}
                categoriesById={categoriesById}
                categoryBudgets={categoryBudgets}
                COLORS={COLORS}
              />
            )}
            {activeTab === "patterns" && (
              <View style={{ gap: SIZES.base + 6 }}>
                {hasWeekendData && <WeekendVsWeekday transactions={currentMonthTransactions} COLORS={COLORS} />}
                {hasWeekendData && hasDonutData && (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.lightGray2 }} />
                )}
                {hasDonutData && (
                  <AccountUsageDonut transactions={currentMonthTransactions} accountsById={accountsById} COLORS={COLORS} />
                )}
                {!hasWeekendData && !hasDonutData && (
                  <Text style={{ ...FONTS.body4, color: COLORS.darkgray, textAlign: "center", paddingVertical: SIZES.padding }}>
                    Add more transactions to see patterns
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Horizontal Insights ───────────────────────────────── */}
        {shownInsights.length > 0 && (
          <View style={styles.insightSection}>
            <Text style={styles.sectionLabel}>Insights</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -SIZES.padding }}
              contentContainerStyle={{ paddingLeft: SIZES.padding, paddingRight: SIZES.padding, gap: 10 }}
            >
              {shownInsights.map((insight, i) => (
                <View key={i} style={[styles.insightCard, { backgroundColor: insight.bgColor }]}>
                  <Icon name={insight.icon} type="material-community" size={20} color={insight.color} />
                  <Text style={[styles.insightCardText, { color: COLORS.primary }]}>{insight.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Callout cards ─────────────────────────────────────── */}
        {(biggestExpense || upcomingDues.length > 0) && (
          <View style={styles.calloutRow}>
            {biggestExpense && (
              <View style={[styles.calloutCard, { backgroundColor: COLORS.peach + "12" }]}>
                <Icon name="trophy-outline" type="material-community" size={20} color={COLORS.peach} />
                <Text style={[styles.calloutLabel, { color: COLORS.darkgray }]}>Biggest expense</Text>
                <Text style={[styles.calloutValue, { color: COLORS.primary }]} numberOfLines={1}>
                  {biggestExpense.description || "—"}
                </Text>
                <Text style={[styles.calloutAmount, { color: COLORS.red2 }]}>
                  ₹{formatAmountWithCommas(biggestExpense.amount, false)}
                </Text>
              </View>
            )}
            {upcomingDues.length > 0 ? (
              <View style={[styles.calloutCard, { backgroundColor: upcomingDues[0].daysUntil <= 3 ? COLORS.red2 + "12" : COLORS.yellow + "15" }]}>
                <Icon name="calendar-clock" type="material-community" size={20} color={upcomingDues[0].daysUntil <= 3 ? COLORS.red2 : COLORS.yellow} />
                <Text style={[styles.calloutLabel, { color: COLORS.darkgray }]}>Next due</Text>
                <Text style={[styles.calloutValue, { color: COLORS.primary }]} numberOfLines={1}>
                  {upcomingDues[0].name}
                </Text>
                <Text style={[styles.calloutAmount, { color: upcomingDues[0].daysUntil <= 3 ? COLORS.red2 : COLORS.primary }]}>
                  {upcomingDues[0].daysUntil === 0 ? "Today" : `${upcomingDues[0].daysUntil}d left`}
                </Text>
              </View>
            ) : biggestExpense ? (
              <View style={[styles.calloutCard, { backgroundColor: COLORS.darkgreen + "12" }]}>
                <Icon name="check-circle-outline" type="material-community" size={20} color={COLORS.darkgreen} />
                <Text style={[styles.calloutLabel, { color: COLORS.darkgray }]}>Dues</Text>
                <Text style={[styles.calloutValue, { color: COLORS.darkgreen }]}>All clear</Text>
                <Text style={[styles.calloutAmount, { color: COLORS.darkgreen }]}>No upcoming</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Accounts ──────────────────────────────────────────── */}
        {accounts.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Accounts</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Banks")}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.accountChip,
                    { backgroundColor: account.is_credit ? COLORS.purple + "12" : COLORS.blue + "12" },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate("AddBank", { account, mode: "edit" })}
                >
                  <Icon
                    name={account.is_credit ? "credit-card-outline" : "wallet-outline"}
                    type="material-community"
                    size={14}
                    color={account.is_credit ? COLORS.purple : COLORS.blue}
                  />
                  <Text style={[styles.accountChipName, { color: COLORS.primary }]} numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text style={[styles.accountChipBalance, { color: account.amount >= 0 ? COLORS.primary : COLORS.red2 }]}>
                    ₹{formatAmountWithCommas(Math.abs(account.amount), false)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Recent Transactions ───────────────────────────────── */}
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

        {/* ── Empty state ───────────────────────────────────────── */}
        {transactions.length === 0 && accounts.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="rocket-launch-outline" type="material-community" size={48} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>Get Started</Text>
            <Text style={styles.emptyText}>Add an account and your first transaction</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* ── Hero — absolutely positioned, morphs into sticky header ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroShell,
          {
            backgroundColor: heroBg,
            height: heroHeight,
            borderBottomLeftRadius: heroBorderRadius,
            borderBottomRightRadius: heroBorderRadius,
          },
        ]}
      >
        {/* Full hero content — fades out as hero shrinks */}
        <Animated.View style={[styles.heroFull, { paddingTop: insets.top + SIZES.base + 2, opacity: fullContentOpacity }]}>
          <Text style={[styles.heroGreeting, { color: heroTextSecondary }]}>
            Hi{firstName ? `, ${firstName}` : ""}
          </Text>
          <Text style={[styles.heroAmount, { color: heroTextPrimary }]}>
            ₹{formatAmountWithCommas(monthlySpent, false)}
          </Text>
          <Text style={[styles.heroSubtitle, { color: heroTextSecondary }]}>
            {monthlyBudget > 0
              ? `of ₹${formatAmountWithCommas(monthlyBudget, false)} budget · ${currentMonthName}`
              : `spent · ${currentMonthName}`}
          </Text>
          {monthlyBudget > 0 && (
            <View style={styles.heroBudgetContainer}>
              <View style={[styles.heroBudgetTrack, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                <View style={[styles.heroBudgetFill, { width: `${Math.min(budgetProgress * 100, 100)}%` as any, backgroundColor: budgetBarColor }]} />
              </View>
              <View style={styles.heroPaceRow}>
                <Text style={[styles.heroPaceText, { color: heroTextSecondary }]}>
                  ₹{formatAmountWithCommas(dailyAvg, false)}/day your pace
                </Text>
                <Text style={[styles.heroPaceText, { color: heroTextSecondary }]}>
                  ideal ₹{formatAmountWithCommas(idealDaily, false)}/day
                </Text>
              </View>
            </View>
          )}
          <View style={styles.heroStats}>
            {monthlyIncome > 0 && (
              <View style={styles.heroPill}>
                <Icon name="trending-up" type="material-community" size={13} color={heroTextPrimary} />
                <Text style={[styles.heroPillText, { color: heroTextPrimary }]}>₹{formatAmountWithCommas(monthlyIncome, false)} earned</Text>
              </View>
            )}
            {spendingChange !== null && (
              <View style={styles.heroPill}>
                <Icon name={spendingChange > 0 ? "arrow-up" : "arrow-down"} type="material-community" size={13} color={heroTextPrimary} />
                <Text style={[styles.heroPillText, { color: heroTextPrimary }]}>{Math.abs(spendingChange)}% vs last mo</Text>
              </View>
            )}
            <View style={styles.heroPill}>
              <Icon name="swap-horizontal" type="material-community" size={13} color={heroTextPrimary} />
              <Text style={[styles.heroPillText, { color: heroTextPrimary }]}>{transactionCount} txns</Text>
            </View>
          </View>
        </Animated.View>

        {/* Mini header — fades in at the bottom of the shrinking hero */}
        <Animated.View style={[styles.heroMini, { opacity: miniContentOpacity }]}>
          <View style={styles.heroMiniRow}>
            <View>
              <Text style={[styles.heroMiniGreeting, { color: heroTextSecondary }]}>
                Hi{firstName ? `, ${firstName}` : ""}
              </Text>
              <Text style={[styles.heroMiniAmount, { color: heroTextPrimary }]}>
                ₹{formatAmountWithCommas(monthlySpent, false)}
              </Text>
            </View>
            {monthlyBudget > 0 && (
              <View style={styles.heroMiniRight}>
                <Text style={[styles.heroMiniPct, { color: budgetProgress > 0.9 ? COLORS.red2 : budgetProgress > 0.7 ? COLORS.yellow : "#4ADE80" }]}>
                  {Math.round(budgetProgress * 100)}%
                </Text>
                <Text style={[styles.heroMiniLabel, { color: heroTextSecondary }]}>of budget</Text>
              </View>
            )}
          </View>
          {monthlyBudget > 0 && (
            <View style={[styles.heroMiniBudgetBar, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
              <View style={[styles.heroMiniBudgetFill, { width: `${Math.min(budgetProgress * 100, 100)}%` as any, backgroundColor: budgetBarColor }]} />
            </View>
          )}
        </Animated.View>
      </Animated.View>

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

    // ── Hero shell — absolutely positioned, height animated ───────
    heroShell: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      overflow: "hidden",
      zIndex: 10,
    },

    // ── Full hero content ──────────────────────────────────────────
    heroFull: {
      paddingHorizontal: SIZES.padding,
      paddingBottom: SIZES.padding * 1.5,
    },

    // ── Mini header — pinned to bottom of the shell ────────────────
    heroMini: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: SIZES.padding,
      paddingBottom: SIZES.base + 4,
    },
    heroMiniRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    heroMiniGreeting: {
      ...FONTS.body4,
      fontSize: 12,
    },
    heroMiniAmount: {
      fontFamily: "Roboto-Black",
      fontSize: 26,
      letterSpacing: -1,
      lineHeight: 30,
    },
    heroMiniRight: {
      alignItems: "flex-end",
    },
    heroMiniPct: {
      fontFamily: "Roboto-Black",
      fontSize: 22,
      letterSpacing: -0.5,
      lineHeight: 26,
    },
    heroMiniLabel: {
      ...FONTS.body4,
      fontSize: 11,
    },
    heroMiniBudgetBar: {
      height: 3,
      borderRadius: 2,
      overflow: "hidden",
      marginTop: 7,
    },
    heroMiniBudgetFill: {
      height: 3,
      borderRadius: 2,
    },

    heroGreeting: {
      ...FONTS.body4,
      fontSize: 14,
      fontWeight: "500",
    },
    heroAmount: {
      fontFamily: "Roboto-Black",
      fontSize: 52,
      lineHeight: 62,
      letterSpacing: -2,
      marginTop: 8,
    },
    heroSubtitle: {
      ...FONTS.body4,
      fontSize: 14,
      marginTop: 2,
    },
    heroBudgetContainer: {
      marginTop: 18,
      gap: 7,
    },
    heroBudgetTrack: {
      height: 4,
      borderRadius: 2,
      overflow: "hidden",
    },
    heroBudgetFill: {
      height: 4,
      borderRadius: 2,
    },
    heroPaceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    heroPaceText: {
      ...FONTS.body4,
      fontSize: 11,
    },
    heroStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 18,
    },
    heroPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(255,255,255,0.15)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    heroPillText: {
      ...FONTS.body4,
      fontSize: 12,
      fontWeight: "600",
    },

    // ── Cards ─────────────────────────────────────────────────────
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
    },
    cardTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: SIZES.base + 4,
    },
    seeAllText: {
      ...FONTS.body4,
      color: COLORS.darkgray,
    },

    // ── Tab strip ─────────────────────────────────────────────────
    tabStrip: {
      flexDirection: "row",
      borderRadius: 10,
      padding: 3,
      marginBottom: SIZES.base + 8,
    },
    tabItem: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      alignItems: "center",
    },
    tabItemActive: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    tabText: {
      ...FONTS.body4,
      fontSize: 13,
    },

    // ── Insights ──────────────────────────────────────────────────
    insightSection: {
      marginBottom: SIZES.base + 4,
    },
    sectionLabel: {
      ...FONTS.h4,
      color: COLORS.primary,
      fontWeight: "700",
      marginBottom: 10,
    },
    insightCard: {
      width: 195,
      borderRadius: 14,
      padding: 14,
      gap: 8,
    },
    insightCardText: {
      ...FONTS.body4,
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 18,
    },

    // ── Callout cards ─────────────────────────────────────────────
    calloutRow: {
      flexDirection: "row",
      gap: SIZES.base + 4,
      marginBottom: SIZES.base + 4,
    },
    calloutCard: {
      flex: 1,
      borderRadius: 14,
      padding: SIZES.padding * 0.7,
      gap: 4,
    },
    calloutLabel: {
      ...FONTS.body4,
      fontSize: 11,
      marginTop: 4,
    },
    calloutValue: {
      ...FONTS.body3,
      fontWeight: "600",
    },
    calloutAmount: {
      ...FONTS.body4,
      fontWeight: "700",
      fontSize: 15,
    },

    // ── Account chips ─────────────────────────────────────────────
    accountChip: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minWidth: 145,
      gap: 3,
    },
    accountChipName: {
      ...FONTS.body4,
      fontWeight: "600",
      fontSize: 13,
      marginTop: 4,
    },
    accountChipBalance: {
      fontFamily: "Roboto-Black",
      fontSize: 18,
      letterSpacing: -0.5,
      lineHeight: 24,
    },

    // ── Empty state ───────────────────────────────────────────────
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
