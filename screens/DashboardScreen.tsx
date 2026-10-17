import React, { useContext, useEffect, useMemo } from "react";
import { View, Text as RNText, StyleSheet } from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { FONT, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import {
  Amount,
  EmptyState,
  GlyphPlate,
  ListRow,
  SectionLabel,
  Stat,
  StatStrip,
  Text,
} from "../components/ui";
import { useExpensifyStore } from "../store/store";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import CustomFAB from "../components/CustomFAB";
import {
  formatAmountWithCommas,
  filterTransactions,
  getMonthRange,
} from "../services/Utils";
import { Transaction } from "../types/entity/Transaction";
import { Category } from "../types/entity/Category";
import { Heatmap, ShareBar } from "../components/charts";

// ─── Insights engine ──────────────────────────────────────────────
type InsightBucket = "warning" | "pattern" | "fun" | "milestone";

interface Insight {
  icon: string;
  text: string;
  color: string;
  bucket: InsightBucket;
}

const generateInsights = (
  currentMonthTransactions: Transaction[],
  prevMonthTransactions: Transaction[],
  allTransactions: Transaction[],
  categoriesById: Record<number, Category>,
  categoryBudgets: Record<
    number,
    import("../types/entity/CategoryBudget").CategoryBudget
  >,
  monthlyBudget: number,
  COLORS: ColorPalette,
  year: number,
  month: number,
  isCurrentMonth: boolean,
): Insight[] => {
  const insights: Insight[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // For past months the whole month has elapsed.
  const currentDay = isCurrentMonth ? new Date().getDate() : daysInMonth;
  const FULL_MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const thisMonthLabel = isCurrentMonth
    ? "this month"
    : `in ${FULL_MONTHS[month]}`;
  const lastMonthLabel = isCurrentMonth
    ? "last month"
    : FULL_MONTHS[month === 0 ? 11 : month - 1];
  const debits = currentMonthTransactions.filter((t) => !t.is_credit);

  if (debits.length === 0) return [];

  const totalSpent = debits.reduce((acc, t) => acc + t.amount, 0);

  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  debits.forEach((t) => {
    const dow = new Date(t.date_time).getDay();
    dayTotals[dow] += t.amount;
  });
  const dayNames = [
    "Sundays",
    "Mondays",
    "Tuesdays",
    "Wednesdays",
    "Thursdays",
    "Fridays",
    "Saturdays",
  ];
  const maxDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
  if (dayTotals[maxDayIdx] > 0 && debits.length >= 3) {
    insights.push({
      icon: "calendar-week",
      text: `You spend the most on ${dayNames[maxDayIdx]}`,
      color: COLORS.purple,
      bucket: "pattern",
    });
  }

  const daySpend: Record<number, number> = {};
  debits.forEach((t) => {
    const d = new Date(t.date_time).getDate();
    daySpend[d] = (daySpend[d] || 0) + t.amount;
  });
  const peakDay = Object.entries(daySpend).sort(([, a], [, b]) => b - a)[0];
  if (peakDay && debits.length >= 3) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    insights.push({
      icon: "chart-bar",
      text: `${months[month]} ${peakDay[0]} was your biggest day: ₹${formatAmountWithCommas(Number(peakDay[1]), false)}`,
      color: COLORS.accentWarm,
      bucket: "pattern",
    });
  }

  const descCounts: Record<string, number> = {};
  debits.forEach((t) => {
    const desc = (t.description || "").trim();
    if (desc) descCounts[desc] = (descCounts[desc] || 0) + 1;
  });
  const topDesc = Object.entries(descCounts).sort(([, a], [, b]) => b - a)[0];
  if (topDesc && topDesc[1] >= 2) {
    insights.push({
      icon: "repeat",
      text: `${topDesc[0]} appears ${topDesc[1]} times ${thisMonthLabel}`,
      color: COLORS.blue,
      bucket: "pattern",
    });
  }

  if (debits.length >= 2) {
    const avg = totalSpent / debits.length;
    insights.push({
      icon: "calculator-variant-outline",
      text: `Your average expense is ₹${formatAmountWithCommas(avg, false)}`,
      color: COLORS.inkSubtle,
      bucket: "fun",
    });
  }

  if (debits.length >= 5) {
    const median = [...debits].sort((a, b) => a.amount - b.amount)[
      Math.floor(debits.length / 2)
    ].amount;
    const smallCount = debits.filter((t) => t.amount < median).length;
    const pct = Math.round((smallCount / debits.length) * 100);
    insights.push({
      icon: "scale-balance",
      text: `${pct}% of your transactions are under ₹${formatAmountWithCommas(median, false)}`,
      color: COLORS.inkMuted,
      bucket: "fun",
    });
  }

  const catSpend: Record<number, number> = {};
  debits.forEach((t) => {
    catSpend[t.category_id] = (catSpend[t.category_id] || 0) + t.amount;
  });
  const prevDebits = prevMonthTransactions.filter(
    (t) => !t.is_credit && new Date(t.date_time).getDate() <= currentDay,
  );
  const prevCatSpend: Record<number, number> = {};
  prevDebits.forEach((t) => {
    prevCatSpend[t.category_id] = (prevCatSpend[t.category_id] || 0) + t.amount;
  });

  let biggestIncreaseCat: { id: number; pct: number } | null = null;
  let biggestDecreaseCat: { id: number; pct: number } | null = null;
  for (const [catId, amount] of Object.entries(catSpend)) {
    const prev = prevCatSpend[Number(catId)] || 0;
    if (prev > 0) {
      const change = Math.round(((amount - prev) / prev) * 100);
      if (
        change > 20 &&
        (!biggestIncreaseCat || change > biggestIncreaseCat.pct)
      )
        biggestIncreaseCat = { id: Number(catId), pct: change };
      if (
        change < -20 &&
        (!biggestDecreaseCat || change < biggestDecreaseCat.pct)
      )
        biggestDecreaseCat = { id: Number(catId), pct: change };
    }
  }
  if (biggestIncreaseCat && categoriesById[biggestIncreaseCat.id]) {
    insights.push({
      icon: "trending-up",
      text: `${categoriesById[biggestIncreaseCat.id].name} is up ${biggestIncreaseCat.pct}% vs ${lastMonthLabel}`,
      color: COLORS.deltaUp,
      bucket: "pattern",
    });
  }
  if (biggestDecreaseCat && categoriesById[biggestDecreaseCat.id]) {
    insights.push({
      icon: "trending-down",
      text: `${categoriesById[biggestDecreaseCat.id].name} is down ${Math.abs(biggestDecreaseCat.pct)}% vs ${lastMonthLabel}`,
      color: COLORS.deltaDown,
      bucket: "pattern",
    });
  }

  if (isCurrentMonth && currentDay >= 5 && monthlyBudget > 0) {
    const projected = Math.round((totalSpent / currentDay) * daysInMonth);
    if (projected > monthlyBudget * 1.1) {
      insights.push({
        icon: "alert-circle-outline",
        text: `At this pace you'll spend ₹${formatAmountWithCommas(projected, false)} by month end`,
        color: COLORS.deltaUp,
        bucket: "warning",
      });
    } else if (projected < monthlyBudget * 0.8) {
      insights.push({
        icon: "party-popper",
        text: `On track to finish under budget at ₹${formatAmountWithCommas(projected, false)}`,
        color: COLORS.deltaDown,
        bucket: "milestone",
      });
    }
  }

  const prevMonthTotal = prevMonthTransactions
    .filter((t) => !t.is_credit)
    .reduce((a, t) => a + t.amount, 0);
  if (prevMonthTotal > 0 && totalSpent > prevMonthTotal) {
    insights.push({
      icon: "alert-outline",
      text: isCurrentMonth
        ? `You've already spent more than all of last month`
        : `You spent more than all of ${lastMonthLabel}`,
      color: COLORS.deltaUp,
      bucket: "warning",
    });
  }

  if (currentDay > 16 && debits.length >= 5) {
    const firstHalf = debits
      .filter((t) => new Date(t.date_time).getDate() <= 15)
      .reduce((a, t) => a + t.amount, 0);
    const secondHalf = debits
      .filter((t) => new Date(t.date_time).getDate() > 15)
      .reduce((a, t) => a + t.amount, 0);
    if (firstHalf > 0 && secondHalf > 0) {
      insights.push({
        icon: "calendar-range",
        text: `You spend more in the ${firstHalf > secondHalf ? "first" : "second"} half of the month`,
        color: COLORS.purple,
        bucket: "pattern",
      });
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
    const timeLabels: Record<
      string,
      { label: string; icon: string; color: string }
    > = {
      morning: { label: "morning", icon: "weather-sunny", color: COLORS.warn },
      afternoon: {
        label: "afternoon",
        icon: "white-balance-sunny",
        color: COLORS.accentWarm,
      },
      evening: {
        label: "evening",
        icon: "weather-sunset",
        color: COLORS.purple,
      },
      night: { label: "night", icon: "weather-night", color: COLORS.inkSubtle },
    };
    const topTime = Object.entries(timeBuckets).sort(
      ([, a], [, b]) => b - a,
    )[0];
    if (topTime[1] > 0) {
      const info = timeLabels[topTime[0]];
      insights.push({
        icon: info.icon,
        text: `You're a ${info.label} spender — most spending happens then`,
        color: info.color,
        bucket: "pattern",
      });
    }
  }

  if (debits.length >= 4) {
    let weekdayTotal = 0,
      weekendTotal = 0,
      weekdayDays = 0,
      weekendDays = 0;
    for (let d = 1; d <= currentDay; d++) {
      const dow = new Date(year, month, d).getDay();
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
      if (ratio > 1.3)
        insights.push({
          icon: "beach",
          text: `You spend ${ratio.toFixed(1)}x more per day on weekends`,
          color: COLORS.accentWarm,
          bucket: "pattern",
        });
      else if (ratio < 0.7)
        insights.push({
          icon: "briefcase-outline",
          text: `Weekdays cost you ${(1 / ratio).toFixed(1)}x more per day than weekends`,
          color: COLORS.blue,
          bucket: "pattern",
        });
    }
  }

  if (Object.keys(catSpend).length >= 2 && debits.length >= 3) {
    const sortedCats = Object.values(catSpend).sort((a, b) => b - a);
    const top2 = sortedCats.slice(0, 2).reduce((a, b) => a + b, 0);
    const concentrationPct = Math.round((top2 / totalSpent) * 100);
    const numCategories = Object.keys(catSpend).length;
    if (concentrationPct > 75) {
      insights.push({
        icon: "target",
        text: `${concentrationPct}% of spending is in just 2 categories`,
        color: COLORS.accentWarm,
        bucket: "fun",
      });
    } else if (numCategories >= 5) {
      insights.push({
        icon: "shape-outline",
        text: `You spread spending across ${numCategories} categories`,
        color: COLORS.deltaDown,
        bucket: "fun",
      });
    }
  }

  const budgetEntries = Object.entries(categoryBudgets);
  if (budgetEntries.length > 0 && debits.length > 0) {
    const daysRemaining = daysInMonth - currentDay;
    let overBudgetCount = 0,
      underBudgetCount = 0;
    for (const [catIdStr, budget] of budgetEntries) {
      const catId = Number(catIdStr);
      const spent = catSpend[catId] || 0;
      const pct = budget.amount > 0 ? spent / budget.amount : 0;
      const catName = categoriesById[catId]?.name;
      if (!catName) continue;
      if (pct > 1) {
        overBudgetCount++;
        if (overBudgetCount === 1)
          insights.push({
            icon: "alert-circle-outline",
            text: `${catName} ${isCurrentMonth ? "is" : "went"} over budget by ₹${formatAmountWithCommas(spent - budget.amount, false)}`,
            color: COLORS.deltaUp,
            bucket: "warning",
          });
      } else if (pct >= 0.8 && daysRemaining > 0) {
        insights.push({
          icon: "speedometer",
          text: `${Math.round(pct * 100)}% through ${catName} budget with ${daysRemaining} days left`,
          color: COLORS.warn,
          bucket: "warning",
        });
      } else {
        underBudgetCount++;
      }
    }
    if (budgetEntries.length >= 2) {
      if (underBudgetCount === budgetEntries.length) {
        insights.push({
          icon: "check-decagram",
          text: `All ${budgetEntries.length} tracked categories are under budget`,
          color: COLORS.deltaDown,
          bucket: "milestone",
        });
      } else if (underBudgetCount > 0 && overBudgetCount > 0) {
        insights.push({
          icon: "chart-box-outline",
          text: `${underBudgetCount} of ${budgetEntries.length} tracked categories under budget`,
          color: COLORS.blue,
          bucket: "fun",
        });
      }
    }
  }

  let logStreak = 0;
  for (let d = currentDay; isCurrentMonth && d >= 1; d--) {
    if (
      currentMonthTransactions.some(
        (t) => new Date(t.date_time).getDate() === d,
      )
    )
      logStreak++;
    else break;
  }
  if (logStreak >= 3)
    insights.push({
      icon: "fire",
      text: `${logStreak} day logging streak — keep it up!`,
      color: COLORS.accentWarm,
      bucket: "milestone",
    });

  const milestones = [500, 250, 100, 50];
  for (const milestone of milestones) {
    if (allTransactions.length >= milestone) {
      insights.push({
        icon: "trophy-outline",
        text: `You've tracked ${allTransactions.length} transactions — nice!`,
        color: COLORS.warn,
        bucket: "milestone",
      });
      break;
    }
  }

  if (isCurrentMonth && currentDay >= 14 && debits.length >= 5) {
    const fullWeeks = Math.floor(currentDay / 7);
    const weekTotals: number[] = [];
    for (let w = 0; w < fullWeeks; w++) {
      const weekStart = w * 7 + 1;
      const weekEnd = weekStart + 6;
      weekTotals.push(
        debits
          .filter((t) => {
            const d = new Date(t.date_time).getDate();
            return d >= weekStart && d <= weekEnd;
          })
          .reduce((a, t) => a + t.amount, 0),
      );
    }
    if (
      weekTotals.length >= 2 &&
      weekTotals.indexOf(Math.min(...weekTotals)) === fullWeeks - 1
    ) {
      insights.push({
        icon: "star-outline",
        text: `This is your lowest spending week so far this month`,
        color: COLORS.deltaDown,
        bucket: "milestone",
      });
    }
  }

  if (
    prevMonthTransactions.length > 0 &&
    currentMonthTransactions.length > prevMonthTransactions.length &&
    isCurrentMonth &&
    currentDay <= 20
  ) {
    insights.push({
      icon: "lightning-bolt",
      text: `More transactions than all of last month already`,
      color: COLORS.blue,
      bucket: "milestone",
    });
  }

  if (debits.length >= 5) {
    const under100 = debits.filter((t) => t.amount < 100).length;
    const microPct = Math.round((under100 / debits.length) * 100);
    if (microPct >= 60)
      insights.push({
        icon: "cash-minus",
        text: `${microPct}% of transactions are under ₹100 — small spends add up`,
        color: COLORS.inkMuted,
        bucket: "fun",
      });
  }

  if (currentDay >= 10 && debits.length >= 5) {
    const paydaySpend = debits
      .filter((t) => new Date(t.date_time).getDate() <= 5)
      .reduce((a, t) => a + t.amount, 0);
    const paydayDailyAvg = paydaySpend / 5;
    const restDays = currentDay - 5;
    const restDailyAvg =
      restDays > 0
        ? debits
            .filter((t) => new Date(t.date_time).getDate() > 5)
            .reduce((a, t) => a + t.amount, 0) / restDays
        : 0;
    if (
      paydayDailyAvg > 0 &&
      restDailyAvg > 0 &&
      paydayDailyAvg > restDailyAvg * 1.5
    ) {
      insights.push({
        icon: "cash-fast",
        text: `You spend ${(paydayDailyAvg / restDailyAvg).toFixed(1)}x more per day in the first 5 days`,
        color: COLORS.accentWarm,
        bucket: "warning",
      });
    }
  }

  if (debits.length >= 7) {
    const dayCatCounts: Record<string, number> = {};
    debits.forEach((t) => {
      const key = `${new Date(t.date_time).getDay()}_${t.category_id}`;
      dayCatCounts[key] = (dayCatCounts[key] || 0) + 1;
    });
    const topPattern = Object.entries(dayCatCounts).sort(
      ([, a], [, b]) => b - a,
    )[0];
    if (topPattern && topPattern[1] >= 3) {
      const [dowStr, catIdStr] = topPattern[0].split("_");
      const dayName = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][Number(dowStr)];
      const cat = categoriesById[Number(catIdStr)];
      if (cat)
        insights.push({
          icon: "calendar-sync",
          text: `Every ${dayName} you spend on ${cat.name}`,
          color: COLORS.purple,
          bucket: "pattern",
        });
    }
  }

  if (debits.length >= 1) {
    const biggest = [...debits].sort((a, b) => b.amount - a.amount)[0];
    const coffees = Math.floor(biggest.amount / 200);
    if (coffees >= 3)
      insights.push({
        icon: "coffee-outline",
        text: `Your biggest expense could buy ${coffees} coffees`,
        color: COLORS.warn,
        bucket: "fun",
      });
  }

  if (prevMonthTransactions.length > 0) {
    const prevCatTotals: Record<number, number> = {};
    prevMonthTransactions
      .filter((t) => !t.is_credit)
      .forEach((t) => {
        prevCatTotals[t.category_id] =
          (prevCatTotals[t.category_id] || 0) + t.amount;
      });
    const prevTopCat = Object.entries(prevCatTotals).sort(
      ([, a], [, b]) => b - a,
    )[0];
    const currTopCat = Object.entries(catSpend).sort(
      ([, a], [, b]) => b - a,
    )[0];
    if (prevTopCat && currTopCat && prevTopCat[0] === currTopCat[0]) {
      const cat = categoriesById[Number(currTopCat[0])];
      if (cat)
        insights.push({
          icon: "crown-outline",
          text: `${cat.name} is your #1 category for the 2nd month running`,
          color: COLORS.warn,
          bucket: "milestone",
        });
    }
  }

  if (debits.length >= 5) {
    const shoppingCat = Object.values(categoriesById).find(
      (c) => c.name.toLowerCase().includes("shopping") && !c.is_deleted,
    );
    if (shoppingCat) {
      const shoppingTxns = debits.filter(
        (t) => t.category_id === shoppingCat.id,
      );
      if (shoppingTxns.length >= 3) {
        const weekendPct = Math.round(
          (shoppingTxns.filter((t) => {
            const dow = new Date(t.date_time).getDay();
            return dow === 0 || dow === 6;
          }).length /
            shoppingTxns.length) *
            100,
        );
        if (weekendPct >= 60)
          insights.push({
            icon: "shopping-outline",
            text: `${weekendPct}% of your shopping happens on weekends`,
            color: COLORS.purple,
            bucket: "pattern",
          });
      }
    }
  }

  return insights;
};

const pickRandomFromBuckets = (
  insights: Insight[],
  maxTotal: number,
): Insight[] => {
  const buckets: Record<InsightBucket, Insight[]> = {
    warning: [],
    pattern: [],
    fun: [],
    milestone: [],
  };
  insights.forEach((i) => buckets[i.bucket].push(i));

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const result: Insight[] = [];
  result.push(...shuffle(buckets.warning).slice(0, 1));
  result.push(...shuffle(buckets.pattern).slice(0, 2));
  result.push(...shuffle(buckets.fun).slice(0, 1));
  result.push(...shuffle(buckets.milestone).slice(0, 1));

  if (result.length < maxTotal) {
    const usedTexts = new Set(result.map((r) => r.text));
    result.push(
      ...shuffle(insights.filter((i) => !usedTexts.has(i.text))).slice(
        0,
        maxTotal - result.length,
      ),
    );
  }

  return result.slice(0, maxTotal);
};

// ─── Main Dashboard ───────────────────────────────────────────────
const HERO_BASE_MAX = 220;
const HERO_BASE_MIN = 72;
const SCROLL_DISTANCE = HERO_BASE_MAX - HERO_BASE_MIN;

// Sections rise in once on first mount, one after another.
const enter = (i: number) => FadeInDown.delay(60 + i * 50).duration(320);

const DashboardScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();

  const heroGradient = COLORS.heroGradient;
  const heroTextPrimary = COLORS.heroInk;
  const heroTextSecondary = COLORS.heroInkMuted;
  const heroBudgetTrack = COLORS.heroTrack;

  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const HERO_MAX_HEIGHT = insets.top + HERO_BASE_MAX;
  const HERO_MIN_HEIGHT = insets.top + HERO_BASE_MIN;

  // Hero collapse runs on the UI thread.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroShellStyle = useAnimatedStyle(() => {
    const r = interpolate(
      scrollY.value,
      [SCROLL_DISTANCE * 0.6, SCROLL_DISTANCE],
      [32, 0],
      Extrapolation.CLAMP,
    );
    return {
      height: interpolate(
        scrollY.value,
        [0, SCROLL_DISTANCE],
        [HERO_MAX_HEIGHT, HERO_MIN_HEIGHT],
        Extrapolation.CLAMP,
      ),
      borderBottomLeftRadius: r,
      borderBottomRightRadius: r,
    };
  }, [HERO_MAX_HEIGHT, HERO_MIN_HEIGHT]);
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE * 0.3, SCROLL_DISTANCE * 0.65],
      [1, 0.55, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [SCROLL_DISTANCE * 0.4, SCROLL_DISTANCE * 0.7, SCROLL_DISTANCE],
      [0, 0.55, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // ── Store ────────────────────────────────────────────────────────
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const userName = useExpensifyStore((state) => state.userName);
  const categoryBudgets = useExpensifyStore((state) => state.categoryBudgets);
  const monthlyBudget = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance"))?.value ||
      "0",
  );

  const transactions = Object.values(transactionsById);
  const accounts = Object.values(accountsById).filter((a) => !a.is_deleted);

  const now = new Date();
  // Follows the month selected on the Transactions screen.
  const { year: selYear, month: selMonth } = useExpensifyStore(
    (state) => state.selectedMonth,
  );
  const isCurrentMonth =
    selYear === now.getFullYear() && selMonth === now.getMonth();
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const elapsedDays = isCurrentMonth ? now.getDate() : daysInMonth;
  const { firstDate, lastDate } = getMonthRange(selYear, selMonth);
  const currentMonthTransactions = filterTransactions(transactions, {
    startDate: firstDate.toISOString(),
    endDate: lastDate.toISOString(),
  });

  const monthlySpent = currentMonthTransactions.reduce(
    (acc, t) => (t.is_credit ? acc : acc + t.amount),
    0,
  );

  const prevMonth = selMonth === 0 ? 11 : selMonth - 1;
  const prevYear = selMonth === 0 ? selYear - 1 : selYear;
  const { firstDate: prevFirst, lastDate: prevLast } = getMonthRange(
    prevYear,
    prevMonth,
  );
  const prevFirstISO = prevFirst.toISOString();
  useEffect(() => {
    ensureTransactionsLoadedFrom(new Date(prevFirstISO));
  }, [prevFirstISO]);
  const prevMonthTransactions = filterTransactions(transactions, {
    startDate: prevFirst.toISOString(),
    endDate: prevLast.toISOString(),
  });
  const prevMonthSpent = prevMonthTransactions
    .filter(
      (t) => !t.is_credit && new Date(t.date_time).getDate() <= elapsedDays,
    )
    .reduce((acc, t) => acc + t.amount, 0);
  const spendingChange =
    prevMonthSpent > 0
      ? Math.round(((monthlySpent - prevMonthSpent) / prevMonthSpent) * 100)
      : null;

  const biggestExpense = currentMonthTransactions
    .filter((t) => !t.is_credit)
    .sort((a, b) => b.amount - a.amount)[0];

  const upcomingDues = accounts
    .filter((a) => a.is_credit && a.due_date)
    .map((a) => {
      const daysUntil = Math.ceil(
        (new Date(a.due_date).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return { ...a, daysUntil };
    })
    .filter((a) => a.daysUntil >= 0 && a.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const transactionCount = currentMonthTransactions.length;
  const firstName = userName ? userName.split(" ")[0] : "";

  const dailyAvg = monthlySpent / Math.max(elapsedDays, 1);
  const idealDaily = monthlyBudget > 0 ? monthlyBudget / daysInMonth : 0;
  const budgetProgress =
    monthlyBudget > 0 ? Math.min(monthlySpent / monthlyBudget, 1) : 0;
  const budgetBarColor =
    budgetProgress > 0.9
      ? COLORS.deltaUp
      : budgetProgress > 0.7
        ? COLORS.warn
        : COLORS.deltaDown;

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const currentMonthName =
    selYear === now.getFullYear()
      ? MONTH_NAMES[selMonth]
      : `${MONTH_NAMES[selMonth]} ${selYear}`;

  const dailySpend = useMemo(() => {
    const out: number[] = new Array(daysInMonth).fill(0);
    currentMonthTransactions.forEach((t) => {
      if (t.is_credit) return;
      const d = new Date(t.date_time).getDate();
      if (d >= 1 && d <= daysInMonth) out[d - 1] += t.amount;
    });
    return out;
  }, [currentMonthTransactions, daysInMonth]);

  const openDay = (day: number) => {
    const start = new Date(selYear, selMonth, day, 0, 0, 0, 0);
    const end = new Date(selYear, selMonth, day, 23, 59, 59, 999);
    navigation.navigate("FilteredTransaction", {
      filter: {
        label: start.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    });
  };

  // ── Derived stats ────────────────────────────────────────────────
  const noSpendDays = useMemo(() => {
    const dailySpend: number[] = new Array(daysInMonth).fill(0);
    currentMonthTransactions
      .filter((t) => !t.is_credit)
      .forEach((t) => {
        const day = new Date(t.date_time).getDate();
        if (day >= 1 && day <= daysInMonth) dailySpend[day - 1] += t.amount;
      });
    return dailySpend.slice(0, elapsedDays).filter((v) => v === 0).length;
  }, [currentMonthTransactions, daysInMonth, elapsedDays]);

  const { weekdayAvg, weekendAvg } = useMemo(() => {
    const debits = currentMonthTransactions.filter((t) => !t.is_credit);
    let wd = 0,
      we = 0,
      wdc = 0,
      wec = 0;
    debits.forEach((t) => {
      const dow = new Date(t.date_time).getDay();
      if (dow === 0 || dow === 6) {
        we += t.amount;
        wec++;
      } else {
        wd += t.amount;
        wdc++;
      }
    });
    return {
      weekdayAvg: wdc > 0 ? wd / wdc : 0,
      weekendAvg: wec > 0 ? we / wec : 0,
    };
  }, [currentMonthTransactions]);

  const topCategories = useMemo(() => {
    const catSpend: Record<number, number> = {};
    currentMonthTransactions
      .filter((t) => !t.is_credit)
      .forEach((t) => {
        catSpend[t.category_id] = (catSpend[t.category_id] || 0) + t.amount;
      });
    return Object.entries(catSpend)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([catId, amount]) => ({ catId: Number(catId), amount }));
  }, [currentMonthTransactions]);

  const insights = useMemo(
    () =>
      generateInsights(
        currentMonthTransactions,
        prevMonthTransactions,
        transactions,
        categoriesById,
        categoryBudgets,
        monthlyBudget,
        COLORS,
        selYear,
        selMonth,
        isCurrentMonth,
      ),
    [
      currentMonthTransactions,
      prevMonthTransactions,
      transactions,
      categoriesById,
      categoryBudgets,
      monthlyBudget,
      COLORS,
      selYear,
      selMonth,
      isCurrentMonth,
    ],
  );
  const shownInsights = useMemo(
    () => pickRandomFromBuckets(insights, 5),
    [insights],
  );

  const hasDebits =
    currentMonthTransactions.filter((t) => !t.is_credit).length > 0;
  const hasWeekendData =
    currentMonthTransactions.filter((t) => !t.is_credit).length >= 3;
  const isEmpty = transactions.length === 0 && accounts.length === 0;
  const rupees = (v: number) => Math.round(v * 100);

  let section = 0;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: HERO_MAX_HEIGHT + SPACE.sm,
            paddingBottom: tabBarHeight + 96,
          },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Quick stats ──────────────────────────────────────────── */}
        {hasDebits && (
          <Animated.View entering={enter(section++)}>
            <StatStrip>
              <Stat
                value={
                  <Amount
                    cents={rupees(dailyAvg)}
                    decimals="never"
                    variant="title"
                  />
                }
                label="avg / day"
              />
              <Stat
                value={<Text variant="title">{noSpendDays}</Text>}
                label="no-spend days"
              />
              <Stat
                value={
                  <Text
                    variant="title"
                    tone={
                      spendingChange === null
                        ? "subtle"
                        : spendingChange > 0
                          ? "up"
                          : "down"
                    }
                  >
                    {spendingChange !== null
                      ? `${spendingChange > 0 ? "+" : ""}${spendingChange}%`
                      : "—"}
                  </Text>
                }
                label="vs last month"
              />
              <Stat
                value={<Text variant="title">{transactionCount}</Text>}
                label="transactions"
              />
            </StatStrip>
          </Animated.View>
        )}

        {/* ── Activity ─────────────────────────────────────────────── */}
        {hasDebits && (
          <Animated.View entering={enter(section++)}>
            <SectionLabel
              title="Activity"
              right={
                <Text variant="caption" tone="subtle">
                  {currentMonthName}
                </Text>
              }
            />
            <Heatmap
              year={selYear}
              month={selMonth}
              daily={dailySpend}
              elapsedDays={elapsedDays}
              onSelectDay={openDay}
            />
          </Animated.View>
        )}

        {/* ── Patterns ─────────────────────────────────────────────── */}
        {hasWeekendData && (weekdayAvg > 0 || weekendAvg > 0) && (
          <Animated.View entering={enter(section++)}>
            <SectionLabel title="Patterns" />
            <View style={styles.patternRow}>
              <View style={styles.patternCol}>
                <Text variant="label" tone="subtle">
                  Weekdays
                </Text>
                <Amount
                  cents={rupees(weekdayAvg)}
                  decimals="never"
                  variant="amountLarge"
                />
                <Text variant="caption" tone="muted">
                  avg per transaction
                </Text>
              </View>
              <View style={styles.patternDivider} />
              <View style={[styles.patternCol, styles.patternColRight]}>
                <Text variant="label" tone="subtle">
                  Weekends
                </Text>
                <Amount
                  cents={rupees(weekendAvg)}
                  decimals="never"
                  variant="amountLarge"
                />
                <Text variant="caption" tone="muted">
                  avg per transaction
                </Text>
              </View>
            </View>
            {weekendAvg > 0 && weekdayAvg > 0 && (
              <Text variant="callout" tone="muted" style={styles.patternLine}>
                {weekendAvg > weekdayAvg
                  ? `${(weekendAvg / weekdayAvg).toFixed(1)}× more per transaction on weekends`
                  : `${(weekdayAvg / weekendAvg).toFixed(1)}× more per transaction on weekdays`}
              </Text>
            )}
          </Animated.View>
        )}

        {/* ── Top categories ───────────────────────────────────────── */}
        {topCategories.length > 0 && (
          <Animated.View entering={enter(section++)}>
            <SectionLabel title="Top spending" />
            {topCategories.map(({ catId, amount }) => {
              const category = categoriesById[catId];
              if (!category) return null;
              const budget = categoryBudgets[catId];
              const hasBudget = !!budget && budget.amount > 0;
              const pct = hasBudget ? amount / budget.amount : null;
              const isOver = hasBudget && amount > budget.amount;
              const catColor =
                COLORS.ordinal[Math.abs(catId) % COLORS.ordinal.length];
              const barColor = isOver
                ? COLORS.deltaUp
                : pct !== null && pct > 0.8
                  ? COLORS.warn
                  : COLORS.deltaDown;
              return (
                <View key={catId} style={styles.catRow}>
                  <GlyphPlate
                    name={category.icon_name}
                    type={category.icon_type}
                    color={catColor}
                    size={36}
                    radius={10}
                  />
                  <View style={styles.catBody}>
                    <View style={styles.catTop}>
                      <Text
                        variant="headline"
                        numberOfLines={1}
                        style={styles.flex}
                      >
                        {category.name}
                      </Text>
                      <Amount cents={rupees(amount)} decimals="never" />
                    </View>
                    {hasBudget ? (
                      <>
                        <ShareBar value={pct!} color={barColor} height={3} style={styles.catTrack} />
                        <Text
                          variant="caption"
                          tone={isOver ? "up" : "muted"}
                          style={styles.catMeta}
                        >
                          {isOver
                            ? `Over by ₹${formatAmountWithCommas(amount - budget.amount, false)}`
                            : `${Math.round(pct! * 100)}% of ₹${formatAmountWithCommas(budget.amount, false)} budget`}
                        </Text>
                      </>
                    ) : (
                      <Text
                        variant="caption"
                        tone="muted"
                        style={styles.catMeta}
                      >
                        {monthlySpent > 0
                          ? `${Math.round((amount / monthlySpent) * 100)}% of spending`
                          : ""}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* ── Insights ─────────────────────────────────────────────── */}
        {shownInsights.length > 0 && (
          <Animated.View entering={enter(section++)}>
            <SectionLabel title="Insights" />
            {shownInsights.map((insight, i) => (
              <View key={i} style={styles.insightRow}>
                <GlyphPlate
                  name={insight.icon}
                  color={insight.color}
                  size={30}
                  radius={9}
                />
                <Text variant="body" style={styles.flex}>
                  {insight.text}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── Highlights ───────────────────────────────────────────── */}
        {(biggestExpense || upcomingDues.length > 0) && (
          <Animated.View entering={enter(section++)}>
            <SectionLabel title="Highlights" />
            {biggestExpense && (
              <ListRow
                padded={false}
                leading={
                  <GlyphPlate
                    name="trophy-outline"
                    color={COLORS.accentWarm}
                    size={36}
                    radius={10}
                  />
                }
                title={biggestExpense.description || "Untitled expense"}
                subtitle="Biggest expense"
                trailing={
                  <Amount
                    cents={rupees(biggestExpense.amount)}
                    decimals="never"
                    tone="up"
                  />
                }
                onPress={() =>
                  navigation.navigate("TransactionEdit", {
                    transaction: biggestExpense,
                    mode: "edit",
                  })
                }
              />
            )}
            {upcomingDues.length > 0 ? (
              <ListRow
                padded={false}
                leading={
                  <GlyphPlate
                    name="calendar-clock"
                    color={
                      upcomingDues[0].daysUntil <= 3
                        ? COLORS.deltaUp
                        : COLORS.warn
                    }
                    size={36}
                    radius={10}
                  />
                }
                title={upcomingDues[0].name}
                subtitle="Next card due"
                trailing={
                  <Text
                    variant="amount"
                    tone={upcomingDues[0].daysUntil <= 3 ? "up" : "ink"}
                  >
                    {upcomingDues[0].daysUntil === 0
                      ? "Today"
                      : `${upcomingDues[0].daysUntil}d left`}
                  </Text>
                }
              />
            ) : (
              biggestExpense && (
                <ListRow
                  padded={false}
                  leading={
                    <GlyphPlate
                      name="check-circle-outline"
                      color={COLORS.deltaDown}
                      size={36}
                      radius={10}
                    />
                  }
                  title="All clear"
                  subtitle="No card dues in the next 30 days"
                />
              )
            )}
          </Animated.View>
        )}

        {!isEmpty && !hasDebits && (
          <EmptyState
            icon="calendar-blank-outline"
            title={`No spending in ${MONTH_NAMES[selMonth]}`}
            message={
              isCurrentMonth
                ? "Expenses you log this month will show up here."
                : "Nothing was logged for this month."
            }
            actionLabel={isCurrentMonth ? "Add a transaction" : undefined}
            onAction={
              isCurrentMonth
                ? () => navigation.navigate("AddTransaction")
                : undefined
            }
            style={styles.empty}
          />
        )}

        {isEmpty && (
          <EmptyState
            icon="rocket-launch-outline"
            title="Let's get started"
            message="Add an account, then log your first transaction."
            actionLabel="Add an account"
            onAction={() => navigation.navigate("AddBank")}
            style={styles.empty}
          />
        )}
      </Animated.ScrollView>

      {/* ── Hero (unchanged look, UI-thread collapse) ─────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroShell,
          { backgroundColor: heroGradient[1] },
          heroShellStyle,
        ]}
      >
        <LinearGradient
          colors={heroGradient as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.heroFull,
            { paddingTop: insets.top + SPACE.sm + 2 },
            fullStyle,
          ]}
        >
          <RNText style={[styles.heroGreeting, { color: heroTextSecondary }]}>
            Hi{firstName ? `, ${firstName}` : ""}
          </RNText>
          <RNText style={[styles.heroAmount, { color: heroTextPrimary }]}>
            ₹{formatAmountWithCommas(monthlySpent, false)}
          </RNText>
          <RNText style={[styles.heroSubtitle, { color: heroTextSecondary }]}>
            {monthlyBudget > 0
              ? `of ₹${formatAmountWithCommas(monthlyBudget, false)} budget · ${currentMonthName}`
              : `spent · ${currentMonthName}`}
          </RNText>
          {monthlyBudget > 0 && (
            <View style={styles.heroBudgetContainer}>
              <View style={{ height: 12 }}>
                <View
                  style={[
                    styles.heroTrack,
                    { backgroundColor: heroBudgetTrack },
                  ]}
                >
                  <View
                    style={{
                      height: 3,
                      width: `${Math.min(budgetProgress * 100, 100)}%`,
                      backgroundColor: budgetBarColor,
                      borderRadius: 2,
                    }}
                  />
                </View>
                <View
                  style={[
                    styles.heroKnob,
                    {
                      left: `${Math.min(budgetProgress * 100, 100)}%`,
                      backgroundColor: budgetBarColor,
                      shadowColor: budgetBarColor,
                    },
                  ]}
                />
              </View>
              <View style={styles.heroPaceRow}>
                <RNText
                  style={[styles.heroPaceText, { color: heroTextSecondary }]}
                >
                  ₹{formatAmountWithCommas(dailyAvg, false)}/day your pace
                </RNText>
                <RNText
                  style={[styles.heroPaceText, { color: heroTextSecondary }]}
                >
                  ideal ₹{formatAmountWithCommas(idealDaily, false)}/day
                </RNText>
              </View>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.heroMini, miniStyle]}>
          <View style={styles.heroMiniRow}>
            <View>
              <RNText
                style={[styles.heroMiniGreeting, { color: heroTextSecondary }]}
              >
                Hi{firstName ? `, ${firstName}` : ""}
              </RNText>
              <RNText
                style={[styles.heroMiniAmount, { color: heroTextPrimary }]}
              >
                ₹{formatAmountWithCommas(monthlySpent, false)}
              </RNText>
            </View>
            {monthlyBudget > 0 && (
              <View style={styles.heroMiniRight}>
                <RNText style={[styles.heroMiniPct, { color: budgetBarColor }]}>
                  {Math.round(budgetProgress * 100)}%
                </RNText>
                <RNText
                  style={[styles.heroMiniLabel, { color: heroTextSecondary }]}
                >
                  of budget
                </RNText>
              </View>
            )}
          </View>
          {monthlyBudget > 0 && (
            <View
              style={[
                styles.heroMiniBudgetBar,
                { backgroundColor: heroBudgetTrack },
              ]}
            >
              <View
                style={[
                  styles.heroMiniBudgetFill,
                  {
                    width: `${Math.min(budgetProgress * 100, 100)}%`,
                    backgroundColor: budgetBarColor,
                  },
                ]}
              />
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
    container: { flex: 1, backgroundColor: COLORS.paper },
    scrollContent: { paddingHorizontal: SPACE.gutter },
    flex: { flex: 1 },

    // ── Hero (visual spec unchanged) ──────────────────────────────
    heroShell: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      overflow: "hidden",
      zIndex: 10,
    },
    heroFull: { paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.gutter },
    heroGreeting: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 20 },
    heroAmount: {
      fontFamily: FONT.black,
      fontSize: 50,
      lineHeight: 60,
      letterSpacing: -2,
      marginTop: 6,
      fontVariant: ["tabular-nums"],
    },
    heroSubtitle: {
      fontFamily: FONT.regular,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 2,
    },
    heroBudgetContainer: { marginTop: 16, gap: 8 },
    heroTrack: {
      position: "absolute",
      top: 4,
      left: 0,
      right: 0,
      height: 3,
      borderRadius: 2,
      overflow: "hidden",
    },
    heroKnob: {
      position: "absolute",
      top: 1,
      marginLeft: -4,
      width: 8,
      height: 8,
      borderRadius: 4,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 5,
      elevation: 4,
    },
    heroPaceRow: { flexDirection: "row", justifyContent: "space-between" },
    heroPaceText: { fontFamily: FONT.regular, fontSize: 11, lineHeight: 16 },
    heroMini: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: SPACE.gutter,
      paddingBottom: SPACE.md,
    },
    heroMiniRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    heroMiniGreeting: {
      fontFamily: FONT.regular,
      fontSize: 12,
      lineHeight: 16,
    },
    heroMiniAmount: {
      fontFamily: FONT.black,
      fontSize: 26,
      letterSpacing: -1,
      lineHeight: 30,
      fontVariant: ["tabular-nums"],
    },
    heroMiniRight: { alignItems: "flex-end" },
    heroMiniPct: {
      fontFamily: FONT.black,
      fontSize: 22,
      letterSpacing: -0.5,
      lineHeight: 26,
    },
    heroMiniLabel: { fontFamily: FONT.regular, fontSize: 11, lineHeight: 16 },
    heroMiniBudgetBar: {
      height: 2,
      borderRadius: 1,
      overflow: "hidden",
      marginTop: 7,
    },
    heroMiniBudgetFill: { height: 2, borderRadius: 1 },

    // ── Patterns ──────────────────────────────────────────────────
    patternRow: { flexDirection: "row", alignItems: "stretch" },
    patternCol: { flex: 1, gap: SPACE.xs },
    patternColRight: { alignItems: "flex-end" },
    patternDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.hairline,
      marginHorizontal: SPACE.lg,
    },
    patternLine: { marginTop: SPACE.md },

    // ── Top categories ────────────────────────────────────────────
    catRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.md,
      paddingVertical: SPACE.sm + 2,
    },
    catBody: { flex: 1 },
    catTop: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
    catTrack: { marginTop: SPACE.sm },
    catMeta: { marginTop: SPACE.xs },

    // ── Insights ──────────────────────────────────────────────────
    insightRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.md,
      paddingVertical: SPACE.sm,
    },

    empty: { marginTop: SPACE.xxl },
  });

export default DashboardScreen;
