import React from "react";
import { View, ViewStyle } from "react-native";
import { TextInput, Portal } from "react-native-paper";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { COLORS } from "../constants";
import DatePickerStyles from "../styles/DatePicker.styles";
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
        style={DatePickerStyles.input}
        theme={{ roundness: 30 }}
      />
      {visible && (
        <Portal>
          <DateTimePicker
            testID="dateTimePicker"
            value={value}
            mode="date"
            display="inline"
            onChange={handleDateChange}
            style={[DatePickerStyles.datePicker, position]} 
            maximumDate={maximumDate}
          />
        </Portal>
      )}
    </View>
  );
};


export default DatePicker;
