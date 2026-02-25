import React, { useCallback, useContext, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Icon } from "@rneui/themed";
import { Text, ActivityIndicator, Snackbar, Button, Switch, Card } from "react-native-paper";
import { FONTS, SIZES } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../services/Supabase";
import { ReloadContext } from "../contexts/ReloadContext";
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
  const reloadData = useContext(ReloadContext);

  // Monthly reports state
  const [monthlyReportsEnabled, setMonthlyReportsEnabled] = useState(false);
  const [nextScheduledDate, setNextScheduledDate] = useState<Date | null>(null);
  const [monthlyReportDay, setMonthlyReportDay] = useState(1);

  // PDF generation states
  const [showDatePickers, setShowDatePickers] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [pdfEndDate, setPdfEndDate] = useState(new Date());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Day picker ref
  const dayPickerRef = React.useRef<DayPickerRef>(null);

  // Store data for PDF generation
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const transactions = Object.values(transactionsById);
  const monthlyBalance = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance")).value,
  );

  const styles = React.useMemo(() => createStyles(COLORS), [COLORS]);

  // Initialize monthly reports state
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

  const handleDaySelect = async (day: number) => {
    setMonthlyReportDay(day);
    await monthlyReportScheduler.setMonthlyReportDay(day);

    if (monthlyReportsEnabled) {
      await monthlyReportScheduler.scheduleNextMonthlyReport();
      const nextDate = await monthlyReportScheduler.getNextScheduledDate();
      setNextScheduledDate(nextDate);
    }

    setSnackbarMessage(`Monthly reports will be sent on day ${day} of each month`);
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

      setSnackbarMessage("PDF generated successfully!");
      setSnackbarVisible(true);
    } catch (error: any) {
      console.error("PDF generation error:", error);
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
        setSnackbarMessage("Monthly reports enabled!");
      } else {
        setNextScheduledDate(null);
        setSnackbarMessage("Monthly reports disabled.");
      }
      setSnackbarVisible(true);
    } catch (error: any) {
      console.error('Error toggling monthly reports:', error);
      setSnackbarMessage(error.message || "Failed to update setting");
      setSnackbarVisible(true);
    }
  };

  return (
    <BottomSheetModalProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <HeaderNavigator onBackPress={() => navigation.goBack()} />
          <HeaderText text="Expenditure Reports" />
          <Text style={styles.subtitle}>Manage your financial reports and schedules</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Monthly Email Reports Card */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Icon
                    name="email"
                    type="material-community"
                    size={24}
                    color={COLORS.white}
                  />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Monthly Email Reports</Text>
                  <Text style={styles.cardSubtitle}>
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

              {monthlyReportsEnabled && (
                <View style={styles.infoBox}>
                  <Icon
                    name="information"
                    type="material-community"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.infoText}>
                    You'll receive a detailed expense report via email on the {monthlyReportDay}
                    {getOrdinalSuffix(monthlyReportDay)} of each month
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Report Schedule Card */}
          <Card style={styles.card}>
            <Card.Content>
              <TouchableOpacity
                onPress={() => dayPickerRef.current?.open()}
                style={styles.cardHeader}
              >
                <View style={[styles.iconCircle, { backgroundColor: COLORS.purple }]}>
                  <Icon
                    name="calendar"
                    type="material-community"
                    size={24}
                    color={COLORS.white}
                  />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Report Schedule</Text>
                  <Text style={styles.cardSubtitle}>
                    Day {monthlyReportDay} of each month
                  </Text>
                </View>
                <Icon
                  name="chevron-right"
                  type="material-community"
                  size={24}
                  color={COLORS.darkgray}
                />
              </TouchableOpacity>
            </Card.Content>
          </Card>

          {/* Download PDF Card */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: COLORS.red2 }]}>
                  <Icon
                    name="file-pdf-box"
                    type="material-community"
                    size={24}
                    color={COLORS.white}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Download Summary</Text>
                  <Text style={styles.cardSubtitle}>
                    Export your expenses as PDF
                  </Text>
                </View>
              </View>

              {!showDatePickers ? (
                <Button
                  mode="contained"
                  onPress={() => setShowDatePickers(true)}
                  style={styles.actionButton}
                  buttonColor={COLORS.primary}
                  loading={generatingPdf}
                  disabled={generatingPdf}
                >
                  {generatingPdf ? "Generating..." : "Select Date Range"}
                </Button>
              ) : (
                <View style={styles.datePickersContainer}>
                  <View style={styles.datePickerSection}>
                    <Text style={styles.dateLabel}>From</Text>
                    <DateTimePicker
                      value={pdfStartDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => date && setPdfStartDate(date)}
                      maximumDate={pdfEndDate}
                      themeVariant={isDark ? 'dark' : 'light'}
                    />
                  </View>

                  <View style={styles.datePickerSection}>
                    <Text style={styles.dateLabel}>To</Text>
                    <DateTimePicker
                      value={pdfEndDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => date && setPdfEndDate(date)}
                      minimumDate={pdfStartDate}
                      themeVariant={isDark ? 'dark' : 'light'}
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <Button
                      mode="outlined"
                      onPress={() => setShowDatePickers(false)}
                      style={styles.halfButton}
                      textColor={COLORS.primary}
                    >
                      Cancel
                    </Button>
                    <Button
                      mode="contained"
                      onPress={generatePdfReport}
                      style={styles.halfButton}
                      buttonColor={COLORS.primary}
                      loading={generatingPdf}
                      disabled={generatingPdf}
                    >
                      Generate
                    </Button>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        </ScrollView>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          style={styles.snackbar}
        >
          {snackbarMessage}
        </Snackbar>

        {/* Day Picker */}
        <DayPicker
          ref={dayPickerRef}
          onSelect={handleDaySelect}
          selectedDay={monthlyReportDay}
        />
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  const lastDigit = day % 10;
  return lastDigit === 1 ? "st" : lastDigit === 2 ? "nd" : lastDigit === 3 ? "rd" : "th";
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.base,
    backgroundColor: COLORS.white,
  },
  subtitle: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginTop: SIZES.base / 2,
    paddingHorizontal: SIZES.padding / 5,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 3,
  },
  card: {
    backgroundColor: COLORS.lightGray,
    marginBottom: SIZES.padding,
    borderRadius: 16,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SIZES.padding / 2,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    marginBottom: 2,
  },
  cardSubtitle: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    padding: SIZES.padding / 2,
    borderRadius: 8,
    marginTop: SIZES.padding,
    alignItems: "center",
  },
  infoText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginLeft: SIZES.base,
    flex: 1,
  },
  actionButton: {
    marginTop: SIZES.padding,
    borderRadius: 12,
  },
  datePickersContainer: {
    marginTop: SIZES.padding,
  },
  datePickerSection: {
    marginBottom: SIZES.padding,
  },
  dateLabel: {
    ...FONTS.body3,
    color: COLORS.primary,
    marginBottom: SIZES.base / 2,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SIZES.padding / 2,
    marginTop: SIZES.base,
  },
  halfButton: {
    flex: 1,
    borderRadius: 12,
  },
  snackbar: {
    backgroundColor: COLORS.darkgreen,
    borderRadius: 12,
    marginBottom: 20,
  },
});
