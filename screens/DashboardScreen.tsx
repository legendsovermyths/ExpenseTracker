import React, { useMemo, useRef } from "react";
import {
  View,
  Text,
  Animated,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, SIZES, PRETTYCOLORS } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Icon } from "react-native-elements";
import { useExpensifyStore } from "../store/store";
import CustomFAB from "../components/CustomFAB";
import {
  formatAmountWithCommas,
  filterTransactions,
  getMonthRange,
} from "../services/Utils";
import { Transaction } from "../types/entity/Transaction";
import { Category } from "../types/entity/Category";

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
    if (dayIndex >= currentDay) return COLORS.lightGray2;
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

  const rows: Array<Array<{ day: number; amount: number } | null>> = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {dayLabels.map((label, i) => (
          <View key={i} style={{ width: cellSize, marginRight: i < cols - 1 ? gap : 0, alignItems: "center" }}>
            <Text style={{ fontSize: 10, color: COLORS.darkgray, fontFamily: "Roboto-Regular" }}>{label}</Text>
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
      <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 10, gap: 3 }}>
        <Text style={{ fontSize: 10, color: COLORS.darkgray }}>less</Text>
        {[COLORS.darkgreen + "30", COLORS.darkgreen + "50", COLORS.yellow + "60", COLORS.peach + "70", COLORS.red2 + "90"].map((c, i) => (
          <View key={i} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} />
        ))}
        <Text style={{ fontSize: 10, color: COLORS.darkgray }}>more</Text>
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

// ─── Main Dashboard ───────────────────────────────────────────────
const DashboardScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS, isDark), [COLORS, isDark]);

  const heroGradient = isDark
    ? (["#1F2638", "#141A26"] as const)
    : (["#194868", "#0F3252"] as const);
  const heroBgFallback = heroGradient[1];
  const heroTextPrimary = "#FFFFFF";
  const heroTextSecondary = isDark ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.65)";
  const heroBudgetTrack = isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.15)";

  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const HERO_BASE_MAX = 220;
  const HERO_BASE_MIN = 72;
  const SCROLL_DISTANCE = HERO_BASE_MAX - HERO_BASE_MIN;
  const HERO_MAX_HEIGHT = insets.top + HERO_BASE_MAX;
  const HERO_MIN_HEIGHT = insets.top + HERO_BASE_MIN;

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

  // ── Store ────────────────────────────────────────────────────────
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
  const budgetBarColor = budgetProgress > 0.9 ? COLORS.red2 : budgetProgress > 0.7 ? COLORS.yellow : COLORS.darkgreen;

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = MONTH_NAMES[now.getMonth()];

  // ── Derived stats ────────────────────────────────────────────────
  const noSpendDays = useMemo(() => {
    const dailySpend: number[] = new Array(daysInMonth).fill(0);
    currentMonthTransactions.filter((t) => !t.is_credit).forEach((t) => {
      const day = new Date(t.date_time).getDate();
      if (day >= 1 && day <= daysInMonth) dailySpend[day - 1] += t.amount;
    });
    return dailySpend.slice(0, now.getDate()).filter((v) => v === 0).length;
  }, [currentMonthTransactions, daysInMonth]);

  const { weekdayAvg, weekendAvg } = useMemo(() => {
    const debits = currentMonthTransactions.filter((t) => !t.is_credit);
    let wd = 0, we = 0, wdc = 0, wec = 0;
    debits.forEach((t) => {
      const dow = new Date(t.date_time).getDay();
      if (dow === 0 || dow === 6) { we += t.amount; wec++; }
      else { wd += t.amount; wdc++; }
    });
    return { weekdayAvg: wdc > 0 ? wd / wdc : 0, weekendAvg: wec > 0 ? we / wec : 0 };
  }, [currentMonthTransactions]);

  const topCategories = useMemo(() => {
    const catSpend: Record<number, number> = {};
    currentMonthTransactions.filter((t) => !t.is_credit).forEach((t) => {
      catSpend[t.category_id] = (catSpend[t.category_id] || 0) + t.amount;
    });
    return Object.entries(catSpend)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([catId, amount]) => ({ catId: Number(catId), amount }));
  }, [currentMonthTransactions]);

  const insights = useMemo(
    () => generateInsights(currentMonthTransactions, prevMonthTransactions, transactions, categoriesById, categoryBudgets, monthlyBudget, COLORS),
    [currentMonthTransactions, prevMonthTransactions, transactions, categoriesById, categoryBudgets, monthlyBudget, COLORS],
  );
  const shownInsights = useMemo(() => pickRandomFromBuckets(insights, 5), [insights]);

  const hasDebits = currentMonthTransactions.filter((t) => !t.is_credit).length > 0;
  const hasWeekendData = currentMonthTransactions.filter((t) => !t.is_credit).length >= 3;

  return (
    <View style={styles.container}>

      {/* ── Scrollable content ───────────────────────────────────── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: HERO_MAX_HEIGHT + SIZES.base }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >

        {/* ── Quick Stats Strip ─────────────────────────────────── */}
        {hasDebits && (
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{formatAmountWithCommas(dailyAvg, false)}</Text>
              <Text style={styles.statLabel}>avg / day</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{noSpendDays}</Text>
              <Text style={styles.statLabel}>no-spend</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, spendingChange !== null ? { color: spendingChange > 0 ? COLORS.red2 : COLORS.darkgreen } : {}]}>
                {spendingChange !== null ? `${spendingChange > 0 ? "+" : ""}${spendingChange}%` : "—"}
              </Text>
              <Text style={styles.statLabel}>vs last mo</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{transactionCount}</Text>
              <Text style={styles.statLabel}>txns</Text>
            </View>
          </View>
        )}

        {hasDebits && <View style={styles.stripSeparator} />}

        {/* ── Activity Heatmap ─────────────────────────────────── */}
        {hasDebits && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>ACTIVITY</Text>
              <Text style={styles.sectionMeta}>{currentMonthName}</Text>
            </View>
            <View style={styles.card}>
              <SpendingHeatmap transactions={currentMonthTransactions} COLORS={COLORS} />
            </View>
          </View>
        )}

        {/* ── Weekend vs Weekday ───────────────────────────────── */}
        {hasWeekendData && (weekdayAvg > 0 || weekendAvg > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PATTERNS</Text>
            <View style={[styles.card, { flexDirection: "row", alignItems: "center" }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.patternCap}>WEEKDAYS</Text>
                <Text style={styles.patternAmount}>₹{formatAmountWithCommas(weekdayAvg, false)}</Text>
                <Text style={styles.patternSub}>avg / transaction</Text>
              </View>
              <View style={styles.patternVsDot}>
                <Text style={styles.patternVsText}>vs</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end", gap: 4 }}>
                <Text style={[styles.patternCap, { textAlign: "right" }]}>WEEKENDS</Text>
                <Text style={styles.patternAmount}>₹{formatAmountWithCommas(weekendAvg, false)}</Text>
                <Text style={styles.patternSub}>avg / transaction</Text>
              </View>
            </View>
            {weekendAvg > 0 && weekdayAvg > 0 && (
              <Text style={styles.patternCompareLine}>
                {weekendAvg > weekdayAvg
                  ? `${(weekendAvg / weekdayAvg).toFixed(1)}× more per transaction on weekends`
                  : `${(weekdayAvg / weekendAvg).toFixed(1)}× more per transaction on weekdays`}
              </Text>
            )}
          </View>
        )}

        {/* ── Category Spotlight ───────────────────────────────── */}
        {topCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SPENDING</Text>
            <View style={styles.categoryRow}>
              {topCategories.map(({ catId, amount }, index) => {
                const category = categoriesById[catId];
                if (!category) return null;
                const budget = categoryBudgets[catId];
                const hasBudget = budget && budget.amount > 0;
                const pct = hasBudget ? Math.min(amount / budget.amount, 1) : null;
                const isOver = hasBudget && amount > budget.amount;
                const color = hasBudget
                  ? (isOver ? COLORS.red2 : (pct! > 0.8 ? COLORS.yellow : COLORS.darkgreen))
                  : PRETTYCOLORS[index % PRETTYCOLORS.length];
                return (
                  <View key={catId} style={styles.categoryCard}>
                    <View style={[styles.categoryIconBox, { backgroundColor: color + "20" }]}>
                      <Icon name={category.icon_name} type={category.icon_type} size={16} color={color} />
                    </View>
                    <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
                    <Text style={styles.categoryAmount}>₹{formatAmountWithCommas(amount, false)}</Text>
                    {pct !== null && (
                      <View style={styles.categoryBar}>
                        <View style={[styles.categoryBarFill, { width: `${Math.min(pct * 100, 100)}%` as any, backgroundColor: color }]} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Insights ─────────────────────────────────────────── */}
        {shownInsights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INSIGHTS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -SIZES.padding }}
              contentContainerStyle={{ paddingLeft: SIZES.padding, paddingRight: SIZES.padding, gap: 10 }}
            >
              {shownInsights.map((insight, i) => (
                <View key={i} style={[styles.insightCard, { borderLeftColor: insight.color }]}>
                  <Icon name={insight.icon} type="material-community" size={20} color={insight.color} />
                  <Text style={styles.insightCardText}>{insight.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Callout Cards ────────────────────────────────────── */}
        {(biggestExpense || upcomingDues.length > 0) && (
          <View style={styles.calloutRow}>
            {biggestExpense && (
              <View style={styles.calloutCard}>
                <View style={[styles.calloutIconWrap, { backgroundColor: COLORS.peach + "18" }]}>
                  <Icon name="trophy-outline" type="material-community" size={16} color={COLORS.peach} />
                </View>
                <Text style={styles.calloutLabel}>Biggest expense</Text>
                <Text style={styles.calloutValue} numberOfLines={1}>{biggestExpense.description || "—"}</Text>
                <Text style={[styles.calloutAmount, { color: COLORS.red2 }]}>
                  ₹{formatAmountWithCommas(biggestExpense.amount, false)}
                </Text>
              </View>
            )}
            {upcomingDues.length > 0 ? (
              <View style={styles.calloutCard}>
                <View style={[styles.calloutIconWrap, { backgroundColor: (upcomingDues[0].daysUntil <= 3 ? COLORS.red2 : COLORS.yellow) + "18" }]}>
                  <Icon name="calendar-clock" type="material-community" size={16} color={upcomingDues[0].daysUntil <= 3 ? COLORS.red2 : COLORS.yellow} />
                </View>
                <Text style={styles.calloutLabel}>Next due</Text>
                <Text style={styles.calloutValue} numberOfLines={1}>{upcomingDues[0].name}</Text>
                <Text style={[styles.calloutAmount, { color: upcomingDues[0].daysUntil <= 3 ? COLORS.red2 : COLORS.primary }]}>
                  {upcomingDues[0].daysUntil === 0 ? "Today" : `${upcomingDues[0].daysUntil}d left`}
                </Text>
              </View>
            ) : biggestExpense ? (
              <View style={styles.calloutCard}>
                <View style={[styles.calloutIconWrap, { backgroundColor: COLORS.darkgreen + "18" }]}>
                  <Icon name="check-circle-outline" type="material-community" size={16} color={COLORS.darkgreen} />
                </View>
                <Text style={styles.calloutLabel}>Dues</Text>
                <Text style={[styles.calloutValue, { color: COLORS.darkgreen }]}>All clear</Text>
                <Text style={[styles.calloutAmount, { color: COLORS.darkgreen }]}>No upcoming</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
        {transactions.length === 0 && accounts.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="rocket-launch-outline" type="material-community" size={48} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>Get Started</Text>
            <Text style={styles.emptyText}>Add an account and your first transaction</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroShell,
          {
            backgroundColor: heroBgFallback,
            height: heroHeight,
            borderBottomLeftRadius: heroBorderRadius,
            borderBottomRightRadius: heroBorderRadius,
          },
        ]}
      >
        <LinearGradient
          colors={heroGradient as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Full hero */}
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
              <View style={{ height: 12 }}>
                <View style={{
                  position: "absolute",
                  top: 4, left: 0, right: 0,
                  height: 3, borderRadius: 2,
                  backgroundColor: heroBudgetTrack,
                  overflow: "hidden",
                }}>
                  <View style={{ height: 3, width: `${Math.min(budgetProgress * 100, 100)}%` as any, backgroundColor: budgetBarColor, borderRadius: 2 }} />
                </View>
                <View style={{
                  position: "absolute",
                  top: 1,
                  left: `${Math.min(budgetProgress * 100, 100)}%` as any,
                  marginLeft: -4,
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: budgetBarColor,
                  shadowColor: budgetBarColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: 5,
                  elevation: 4,
                }} />
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
        </Animated.View>

        {/* Mini header */}
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
                <Text style={[styles.heroMiniPct, { color: budgetBarColor }]}>
                  {Math.round(budgetProgress * 100)}%
                </Text>
                <Text style={[styles.heroMiniLabel, { color: heroTextSecondary }]}>of budget</Text>
              </View>
            )}
          </View>
          {monthlyBudget > 0 && (
            <View style={[styles.heroMiniBudgetBar, { backgroundColor: heroBudgetTrack }]}>
              <View style={[styles.heroMiniBudgetFill, { width: `${Math.min(budgetProgress * 100, 100)}%` as any, backgroundColor: budgetBarColor }]} />
            </View>
          )}
        </Animated.View>
      </Animated.View>

      <CustomFAB />
    </View>
  );
};

const createStyles = (COLORS: ColorPalette, isDark: boolean) => {
  const cardBorder = isDark
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.gray }
    : null;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.white,
    },
    scrollContent: {
      paddingHorizontal: SIZES.padding,
    },

    // ── Hero ──────────────────────────────────────────────────────
    heroShell: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      overflow: "hidden",
      zIndex: 10,
    },
    heroFull: {
      paddingHorizontal: SIZES.padding,
      paddingBottom: SIZES.padding,
    },
    heroGreeting: {
      ...FONTS.body4,
      fontSize: 14,
      fontWeight: "500",
    },
    heroAmount: {
      fontFamily: "Roboto-Black",
      fontSize: 50,
      lineHeight: 60,
      letterSpacing: -2,
      marginTop: 6,
    },
    heroSubtitle: {
      ...FONTS.body4,
      fontSize: 13,
      marginTop: 2,
    },
    heroBudgetContainer: {
      marginTop: 16,
      gap: 8,
    },
    heroPaceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    heroPaceText: {
      ...FONTS.body4,
      fontSize: 11,
    },

    // ── Mini header ───────────────────────────────────────────────
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
      height: 2,
      borderRadius: 1,
      overflow: "hidden",
      marginTop: 7,
    },
    heroMiniBudgetFill: {
      height: 2,
      borderRadius: 1,
    },

    // ── Stats strip ───────────────────────────────────────────────
    statsStrip: {
      flexDirection: "row",
      paddingVertical: SIZES.padding * 0.85,
    },
    statItem: {
      flex: 1,
      alignItems: "center",
      gap: 3,
    },
    statValue: {
      fontFamily: "Roboto-Black",
      fontSize: 19,
      letterSpacing: -0.5,
      color: COLORS.primary,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: "Roboto-Regular",
      color: COLORS.darkgray,
    },
    statDivider: {
      width: 1,
      backgroundColor: COLORS.lightGray2,
      marginVertical: 6,
    },
    stripSeparator: {
      height: 1,
      backgroundColor: COLORS.lightGray,
      marginBottom: SIZES.padding,
    },

    // ── Sections ──────────────────────────────────────────────────
    section: {
      marginBottom: SIZES.padding,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 10,
      letterSpacing: 2,
      fontFamily: "Roboto-Bold",
      color: COLORS.darkgray,
      marginBottom: 12,
    },
    sectionMeta: {
      fontSize: 11,
      fontFamily: "Roboto-Regular",
      color: COLORS.darkgray,
      marginBottom: 12,
    },

    // ── Card ──────────────────────────────────────────────────────
    card: {
      backgroundColor: COLORS.lightGray,
      borderRadius: 20,
      padding: SIZES.padding,
      ...cardBorder,
    },

    // ── Patterns (weekend vs weekday) ─────────────────────────────
    patternCap: {
      fontSize: 10,
      letterSpacing: 1.5,
      fontFamily: "Roboto-Bold",
      color: COLORS.darkgray,
    },
    patternAmount: {
      fontFamily: "Roboto-Black",
      fontSize: 26,
      letterSpacing: -1,
      color: COLORS.primary,
      lineHeight: 32,
    },
    patternSub: {
      fontSize: 11,
      fontFamily: "Roboto-Regular",
      color: COLORS.darkgray,
    },
    patternVsDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: COLORS.lightGray2,
      justifyContent: "center",
      alignItems: "center",
      marginHorizontal: SIZES.base,
    },
    patternVsText: {
      fontSize: 11,
      fontFamily: "Roboto-Bold",
      color: COLORS.darkgray,
    },
    patternCompareLine: {
      fontSize: 12,
      fontFamily: "Roboto-Regular",
      color: COLORS.darkgray,
      textAlign: "center",
      marginTop: 8,
    },

    // ── Category spotlight ────────────────────────────────────────
    categoryRow: {
      flexDirection: "row",
      gap: SIZES.base + 2,
    },
    categoryCard: {
      flex: 1,
      backgroundColor: COLORS.lightGray,
      borderRadius: 16,
      padding: 12,
      gap: 6,
      ...cardBorder,
    },
    categoryIconBox: {
      width: 32,
      height: 32,
      borderRadius: 9,
      justifyContent: "center",
      alignItems: "center",
    },
    categoryName: {
      fontSize: 11,
      fontFamily: "Roboto-Regular",
      color: COLORS.darkgray,
    },
    categoryAmount: {
      fontFamily: "Roboto-Black",
      fontSize: 16,
      letterSpacing: -0.5,
      color: COLORS.primary,
      lineHeight: 20,
    },
    categoryBar: {
      height: 2,
      backgroundColor: COLORS.lightGray2,
      borderRadius: 1,
      overflow: "hidden",
      marginTop: 2,
    },
    categoryBarFill: {
      height: 2,
      borderRadius: 1,
    },

    // ── Insights ──────────────────────────────────────────────────
    insightCard: {
      width: 190,
      borderRadius: 14,
      padding: 14,
      gap: 8,
      backgroundColor: COLORS.lightGray,
      borderLeftWidth: 3,
      ...(isDark ? { borderTopWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.gray, borderRightColor: COLORS.gray, borderBottomColor: COLORS.gray } : null),
    },
    insightCardText: {
      ...FONTS.body4,
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 18,
      color: COLORS.primary,
    },

    // ── Callout cards ─────────────────────────────────────────────
    calloutRow: {
      flexDirection: "row",
      gap: SIZES.base + 4,
      marginBottom: SIZES.padding,
    },
    calloutCard: {
      flex: 1,
      backgroundColor: COLORS.lightGray,
      borderRadius: 16,
      padding: SIZES.padding * 0.75,
      gap: 4,
      ...cardBorder,
    },
    calloutIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 9,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    calloutLabel: {
      fontSize: 11,
      fontFamily: "Roboto-Regular",
      color: COLORS.darkgray,
    },
    calloutValue: {
      ...FONTS.body3,
      fontWeight: "600",
      color: COLORS.primary,
    },
    calloutAmount: {
      fontSize: 15,
      fontFamily: "Roboto-Bold",
      letterSpacing: -0.3,
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
};

export default DashboardScreen;
