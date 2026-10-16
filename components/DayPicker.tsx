import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { Pressable, Sheet, SheetRef, Text } from "./ui";

export interface DayPickerRef {
  open: () => void;
  close: () => void;
}

type Props = {
  onSelect: (day: number) => void;
  selectedDay?: number;
};

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CELL = 40;

/** Day-of-month picker sheet (1–31). */
const DayPicker = forwardRef<DayPickerRef, Props>(({ onSelect, selectedDay = 1 }, ref) => {
  const { COLORS } = useTheme();
  const sheet = useRef<SheetRef>(null);

  useImperativeHandle(ref, () => ({
    open: () => sheet.current?.present(),
    close: () => sheet.current?.dismiss(),
  }));

  const handlePress = (day: number) => {
    onSelect(day);
    sheet.current?.dismiss();
  };

  return (
    <Sheet ref={sheet} title="Day of month">
      <View style={styles.grid}>
        {DAYS.map((day) => {
          const selected = day === selectedDay;
          return (
            <View key={day} style={styles.slot}>
              <Pressable
                onPress={() => handlePress(day)}
                haptic="selection"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Day ${day}`}
                style={[styles.cell, selected && { backgroundColor: COLORS.accent }]}
              >
                <Text variant="headline" tone={selected ? "onAccent" : "ink"} style={styles.tabular}>
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  slot: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: SPACE.xs },
  cell: { width: CELL, height: CELL, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  tabular: { fontVariant: ["tabular-nums"] },
});

DayPicker.displayName = "DayPicker";
export default DayPicker;
