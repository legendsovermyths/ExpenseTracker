import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";

export interface DayPickerRef {
  open: () => void;
  close: () => void;
}

type Props = {
  onSelect: (day: number) => void;
  selectedDay?: number;
};

const DayPicker = forwardRef<DayPickerRef, Props>(
  ({ onSelect, selectedDay = 1 }, ref) => {
    const { COLORS } = useTheme();
    const styles = useMemo(() => createStyles(COLORS), [COLORS]);
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ["50%"], []);

    useImperativeHandle(ref, () => ({
      open: () => {
        sheetRef.current?.present();
      },
      close: () => {
        sheetRef.current?.dismiss();
      },
    }));

    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    const handlePress = (day: number) => {
      onSelect(day);
      sheetRef.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetView style={styles.contentContainer}>
          <Text style={styles.title}>Select Day of Month</Text>
          <FlatList
            contentContainerStyle={styles.grid}
            data={days}
            numColumns={6}
            keyExtractor={(item) => item.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.dayItem,
                  selectedDay === item && styles.selectedDayItem,
                ]}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayText,
                    selectedDay === item && styles.selectedDayText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

export default DayPicker;

const createStyles = (COLORS: ColorPalette) => StyleSheet.create({
  sheetBackground: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
  },
  contentContainer: {
    padding: SIZES.padding,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: SIZES.padding,
  },
  grid: {
    paddingHorizontal: SIZES.base,
  },
  dayItem: {
    width: 45,
    height: 45,
    margin: SIZES.base / 2,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  selectedDayItem: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayText: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: "600",
  },
  selectedDayText: {
    color: COLORS.white,
  },
});
