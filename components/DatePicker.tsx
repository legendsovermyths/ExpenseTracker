import React, { useMemo } from "react";
import { View, ViewStyle } from "react-native";
import { TextInput, Portal } from "react-native-paper";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { createStyles } from "../styles/DatePicker.styles";
import { useTheme } from "../contexts/ThemeContext";
interface DatePickerProps {
  label?: string;
  value: Date;
  visible: boolean;
  initialDate?: Date;
  maximumDate?: Date;
  position?: ViewStyle;
  onDateChange?: (date: Date | undefined) => void;
  onTouchStart: () => void;
}

const DatePicker: React.FC<DatePickerProps> = ({
  label = "Date",
  value,
  maximumDate = new Date(),
  onDateChange = () => {},
  onTouchStart = () => {},
  visible,
  position,
}) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const handleDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    onDateChange(selectedDate);
  };

  return (
    <View>
      <TextInput
        outlineColor={COLORS.primary}
        activeOutlineColor={COLORS.primary}
        mode="outlined"
        label={label}
        value={value.toLocaleDateString()}
        editable={false}
        onTouchStart={onTouchStart}
        style={styles.input}
        textColor={COLORS.black}
        theme={{
          roundness: 30,
          colors: {
            onSurfaceVariant: COLORS.darkgray,
          }
        }}
      />
      {visible && (
        <Portal>
          <DateTimePicker
            testID="dateTimePicker"
            value={value}
            mode="date"
            display="inline"
            onChange={handleDateChange}
            style={[styles.datePicker, position]}
            maximumDate={maximumDate}
          />
        </Portal>
      )}
    </View>
  );
};


export default DatePicker;
