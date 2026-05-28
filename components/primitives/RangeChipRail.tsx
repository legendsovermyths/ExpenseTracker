import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { FONTS, SIZES } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Chip from "./Chip";

export type RangePresetKey =
  | "week"
  | "month"
  | "3m"
  | "6m"
  | "year"
  | "custom";

export interface RangeValue {
  key: RangePresetKey;
  start: Date;
  end: Date;
}

const today = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

const startOf = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

export const presetRange = (key: RangePresetKey, customStart?: Date, customEnd?: Date): { start: Date; end: Date } => {
  const end = today();
  switch (key) {
    case "week":
      return { start: addDays(end, -6), end };
    case "month": {
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return { start, end };
    }
    case "3m":
      return { start: addMonths(end, -3), end };
    case "6m":
      return { start: addMonths(end, -6), end };
    case "year":
      return { start: addMonths(end, -12), end };
    case "custom":
      return {
        start: customStart ? startOf(customStart) : addDays(end, -30),
        end: customEnd ? startOf(customEnd) : end,
      };
  }
};

const PRESETS: { key: RangePresetKey; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "year", label: "Year" },
  { key: "custom", label: "Custom" },
];

const fmt = (d: Date) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
};

export interface RangeChipRailProps {
  value: RangeValue;
  onChange: (next: RangeValue) => void;
}

const RangeChipRail: React.FC<RangeChipRailProps> = ({ value, onChange }) => {
  const { COLORS, isDark } = useTheme();
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<{ start: Date; end: Date }>({
    start: value.start,
    end: value.end,
  });
  const [editing, setEditing] = useState<"start" | "end">("start");

  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const handleSelect = (key: string) => {
    const k = key as RangePresetKey;
    if (k === "custom") {
      setDraft({ start: value.start, end: value.end });
      setEditing("start");
      setCustomOpen(true);
      return;
    }
    const r = presetRange(k);
    onChange({ key: k, start: r.start, end: r.end });
  };

  const applyCustom = () => {
    let { start, end } = draft;
    if (end < start) {
      const t = start;
      start = end;
      end = t;
    }
    onChange({ key: "custom", start: startOf(start), end: startOf(end) });
    setCustomOpen(false);
  };

  return (
    <>
      <Chip
        options={PRESETS}
        value={value.key}
        onChange={handleSelect}
      />

      <Modal
        visible={customOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCustomOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Custom range</Text>
            <View style={styles.sheetTabs}>
              <TouchableOpacity
                style={[styles.sheetTab, editing === "start" && styles.sheetTabActive]}
                onPress={() => setEditing("start")}
              >
                <Text style={styles.sheetTabLabel}>From</Text>
                <Text style={[styles.sheetTabValue, editing === "start" && { color: COLORS.ink }]}>
                  {fmt(draft.start)}
                </Text>
              </TouchableOpacity>
              <Text style={styles.sheetTabSep}>→</Text>
              <TouchableOpacity
                style={[styles.sheetTab, editing === "end" && styles.sheetTabActive]}
                onPress={() => setEditing("end")}
              >
                <Text style={styles.sheetTabLabel}>To</Text>
                <Text style={[styles.sheetTabValue, editing === "end" && { color: COLORS.ink }]}>
                  {fmt(draft.end)}
                </Text>
              </TouchableOpacity>
            </View>

            <DateTimePicker
              value={editing === "start" ? draft.start : draft.end}
              mode="date"
              display="inline"
              maximumDate={editing === "end" ? today() : draft.end}
              themeVariant={isDark ? "dark" : "light"}
              onChange={(_, picked) => {
                if (!picked) return;
                const d = startOf(picked);
                setDraft((cur) =>
                  editing === "start" ? { ...cur, start: d } : { ...cur, end: d },
                );
              }}
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setCustomOpen(false)} style={styles.sheetCancel}>
                <Text style={[styles.sheetActionText, { color: COLORS.inkMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyCustom} style={[styles.sheetApply, { backgroundColor: COLORS.ink }]}>
                <Text style={[styles.sheetActionText, { color: COLORS.paper }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: COLORS.paper,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: SIZES.padding,
      paddingBottom: SIZES.padding * 1.5,
    },
    sheetTitle: {
      ...FONTS.screenTitle,
      fontSize: 20,
      color: COLORS.ink,
      marginBottom: SIZES.padding * 0.6,
    },
    sheetTabs: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    sheetTab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.hairline,
      backgroundColor: COLORS.surface1,
    },
    sheetTabActive: {
      borderColor: COLORS.ink,
    },
    sheetTabLabel: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    sheetTabValue: {
      ...FONTS.amountInline,
      fontSize: 18,
      color: COLORS.inkMuted,
      marginTop: 2,
    },
    sheetTabSep: {
      ...FONTS.bodyM,
      color: COLORS.inkMuted,
    },
    sheetActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: SIZES.padding * 0.5,
    },
    sheetCancel: {
      paddingVertical: 12,
      paddingHorizontal: 18,
    },
    sheetApply: {
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 12,
    },
    sheetActionText: {
      ...FONTS.bodyM,
      fontWeight: "600",
    },
  });

export default RangeChipRail;
