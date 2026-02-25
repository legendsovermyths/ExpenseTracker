import React, { useCallback, useContext, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Icon } from "@rneui/themed";
import { Text, Snackbar, Button, Switch } from "react-native-paper";
import { FONTS, SIZES } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PdfGenerator } from "../services/PdfGenerator";
import { monthlyReportScheduler } from "../services/MonthlyReportScheduler";
import DayPicker, { DayPickerRef } from "../components/DayPicker";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useTheme } from "../contexts/ThemeContext";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";

export default function ExpenditureReportsScreen() {
  const { COLORS, isDark } = useTheme();
  const navigation: any = useNavigation();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const [monthlyReportsEnabled, setMonthlyReportsEnabled] = useState(false);
  const [nextScheduledDate, setNextScheduledDate] = useState<Date | null>(null);
  const [monthlyReportDay, setMonthlyReportDay] = useState(1);

  const [showDatePickers, setShowDatePickers] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [pdfEndDate, setPdfEndDate] = useState(new Date());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const dayPickerRef = React.useRef<DayPickerRef>(null);

  const transactionsById = useExpensifyStore((state) => state.transactions);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const transactions = Object.values(transactionsById);
  const monthlyBalance = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance")).value,
  );

  const styles = React.useMemo(() => createStyles(COLORS), [COLORS]);

  useEffect(() => {
    const initializeMonthlyReports = async () => {
      try {
        const enabled = await monthlyReportScheduler.isMonthlyReportEnabled();
        const nextDate = await monthlyReportScheduler.getNextScheduledDate();
        const reportDay = await monthlyReportScheduler.getMonthlyReportDay();
        setMonthlyReportsEnabled(enabled);
        setNextScheduledDate(nextDate);
        setMonthlyReportDay(reportDay);
      } catch (error) {
        console.error('Error initializing monthly reports:', error);
      }
    };
    initializeMonthlyReports();
  }, []);

  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    const lastDigit = day % 10;
    return lastDigit === 1 ? "st" : lastDigit === 2 ? "nd" : lastDigit === 3 ? "rd" : "th";
  };

  const handleDaySelect = async (day: number) => {
    setMonthlyReportDay(day);
    await monthlyReportScheduler.setMonthlyReportDay(day);
    if (monthlyReportsEnabled) {
      await monthlyReportScheduler.scheduleNextMonthlyReport();
      const nextDate = await monthlyReportScheduler.getNextScheduledDate();
      setNextScheduledDate(nextDate);
    }
    setSnackbarMessage(`Reports scheduled for day ${day}`);
    setSnackbarVisible(true);
  };

  const generatePdfReport = useCallback(async () => {
    setGeneratingPdf(true);
    setShowDatePickers(false);
    try {
      const pdfGenerator = new PdfGenerator(
        transactions,
        accountsById,
        categoriesById,
        monthlyBalance
      );
      await pdfGenerator.generateAndSharePdf(pdfStartDate, pdfEndDate);
      setSnackbarMessage("PDF generated");
      setSnackbarVisible(true);
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to generate PDF");
      setSnackbarVisible(true);
    } finally {
      setGeneratingPdf(false);
    }
  }, [transactions, accountsById, categoriesById, monthlyBalance, pdfStartDate, pdfEndDate]);

  const handleMonthlyReportsToggle = async (enabled: boolean) => {
    try {
      await monthlyReportScheduler.setMonthlyReportEnabled(enabled);
      setMonthlyReportsEnabled(enabled);
      if (enabled) {
        const nextDate = await monthlyReportScheduler.getNextScheduledDate();
        setNextScheduledDate(nextDate);
        setSnackbarMessage("Monthly reports enabled");
      } else {
        setNextScheduledDate(null);
        setSnackbarMessage("Monthly reports disabled");
      }
      setSnackbarVisible(true);
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to update");
      setSnackbarVisible(true);
    }
  };

  return (
    <BottomSheetModalProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <HeaderNavigator onBackPress={() => navigation.goBack()} />
          <HeaderText text="Reports" />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Monthly Email Reports */}
          <View style={styles.optionRow}>
            <Icon name="email-outline" type="material-community" size={22} color={COLORS.primary} />
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Monthly Email Reports</Text>
              <Text style={styles.optionSubtitle}>
                {monthlyReportsEnabled
                  ? nextScheduledDate
                    ? `Next: ${nextScheduledDate.toLocaleDateString()}`
                    : "Enabled"
                  : "Disabled"
                }
              </Text>
            </View>
            <Switch
              value={monthlyReportsEnabled}
              onValueChange={handleMonthlyReportsToggle}
              color={COLORS.primary}
            />
          </View>

          {/* Report Day */}
          <TouchableOpacity style={styles.optionRow} onPress={() => dayPickerRef.current?.open()}>
            <Icon name="calendar-outline" type="material-community" size={22} color={COLORS.primary} />
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Report Day</Text>
              <Text style={styles.optionSubtitle}>
                {monthlyReportDay}{getOrdinalSuffix(monthlyReportDay)} of each month
              </Text>
            </View>
            <Icon name="chevron-right" type="material-community" size={22} color={COLORS.darkgray} />
          </TouchableOpacity>

          {/* Download PDF */}
          <View style={styles.optionRow}>
            <Icon name="file-pdf-box" type="material-community" size={22} color={COLORS.primary} />
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Download Summary</Text>
              <Text style={styles.optionSubtitle}>Export expenses as PDF</Text>
            </View>
          </View>

          {/* Date Range Selection */}
          <View style={styles.dateSection}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>From</Text>
              <DateTimePicker
                value={pdfStartDate}
                mode="date"
                display="default"
                onChange={(e, d) => d && setPdfStartDate(d)}
                maximumDate={pdfEndDate}
                themeVariant={isDark ? 'dark' : 'light'}
                style={styles.datePicker}
              />
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>To</Text>
              <DateTimePicker
                value={pdfEndDate}
                mode="date"
                display="default"
                onChange={(e, d) => d && setPdfEndDate(d)}
                minimumDate={pdfStartDate}
                themeVariant={isDark ? 'dark' : 'light'}
                style={styles.datePicker}
              />
            </View>
            <Button
              mode="contained"
              onPress={generatePdfReport}
              style={styles.generateButton}
              buttonColor={COLORS.primary}
              loading={generatingPdf}
              disabled={generatingPdf}
            >
              Generate PDF
            </Button>
          </View>
        </ScrollView>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2000}
          style={styles.snackbar}
        >
          {snackbarMessage}
        </Snackbar>

        <DayPicker
          ref={dayPickerRef}
          onSelect={handleDaySelect}
          selectedDay={monthlyReportDay}
        />
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  optionContent: {
    flex: 1,
    marginLeft: SIZES.padding,
  },
  optionTitle: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  optionSubtitle: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginTop: 2,
  },
  dateSection: {
    marginTop: SIZES.padding,
    paddingTop: SIZES.padding,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SIZES.padding,
  },
  dateLabel: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  datePicker: {
    marginLeft: SIZES.padding,
  },
  generateButton: {
    marginTop: SIZES.padding,
    borderRadius: 8,
  },
  snackbar: {
    backgroundColor: COLORS.primary,
  },
});
