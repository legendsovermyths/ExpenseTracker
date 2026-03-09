import React, { useCallback, useContext, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ListRenderItemInfo,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import { ListItem, Icon } from "@rneui/themed";
import { Text, ActivityIndicator, Snackbar, Button } from "react-native-paper";
import { COLORS, FONTS, SIZES } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../services/Supabase";
import { ReloadContext } from "../contexts/ReloadContext";
import { useExpensifyStore } from "../store/store";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PdfGenerator } from "../services/PdfGenerator";
import { getLastMonthRange } from "../services/_Utils";
import { monthlyReportScheduler } from "../services/MonthlyReportScheduler";
import { Switch } from "react-native-paper";
import * as Notifications from 'expo-notifications';
import DayPicker, { DayPickerRef } from "../components/DayPicker";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

type ReportOption = {
  id: "monthlyToggle" | "monthlyDate" | "downloadPdf" | "testNotification" | "testImmediate";
  title: string;
  icon: string;
  type: "toggle" | "action" | "date";
};

const REPORT_OPTIONS: ReportOption[] = [
  { id: "monthlyToggle", title: "Monthly Email Reports", icon: "email", type: "toggle" },
  { id: "monthlyDate", title: "Monthly Report Date", icon: "calendar", type: "date" },
  { id: "downloadPdf", title: "Download Expenditure Summary", icon: "file-pdf-box", type: "action" },
];

export default function ExpenditureReportsScreen() {
  const navigation: any = useNavigation();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const reloadData = useContext(ReloadContext);

  // Monthly reports state
  const [monthlyReportsEnabled, setMonthlyReportsEnabled] = useState(false);
  const [nextScheduledDate, setNextScheduledDate] = useState<Date | null>(null);
  const [monthlyReportDay, setMonthlyReportDay] = useState(1); // Default to 1st of month

  // PDF generation states
  const [showDateModal, setShowDateModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
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

  // PDF generation functions
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowStartDatePicker(false);
      return;
    }
    
    if (selectedDate) {
      setPdfStartDate(selectedDate);
      // Don't close the modal here - let user press Done
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowEndDatePicker(false);
      return;
    }
    
    if (selectedDate) {
      setPdfEndDate(selectedDate);
      // Don't close the modal here - let user press Done
    }
  };

  const handleDaySelect = async (day: number) => {
    setMonthlyReportDay(day);
    await monthlyReportScheduler.setMonthlyReportDay(day);
    
    // If monthly reports are enabled, reschedule with new day
    if (monthlyReportsEnabled) {
      await monthlyReportScheduler.scheduleNextMonthlyReport();
      const nextDate = await monthlyReportScheduler.getNextScheduledDate();
      setNextScheduledDate(nextDate);
    }
    
    setSnackbarMessage(`Monthly reports will be sent on the ${day}${getOrdinalSuffix(day)} of each month`);
    setSnackbarVisible(true);
  };

  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    const lastDigit = day % 10;
    return lastDigit === 1 ? "st" : lastDigit === 2 ? "nd" : lastDigit === 3 ? "rd" : "th";
  };

  const openStartDatePicker = () => {
    setShowStartDatePicker(true);
  };

  const openEndDatePicker = () => {
    setShowStartDatePicker(false);
    setShowEndDatePicker(true);
  };

  const generatePdfReport = useCallback(async () => {
    setGeneratingPdf(true);
    setShowDateModal(false);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    
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

  const showDateSelectionModal = () => {
    setShowDateModal(true);
  };

  const closeDateModal = () => {
    setShowDateModal(false);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
  };

  // Handle monthly reports toggle
  const handleMonthlyReportsToggle = async (enabled: boolean) => {
    try {
      await monthlyReportScheduler.setMonthlyReportEnabled(enabled);
      setMonthlyReportsEnabled(enabled);
      
      if (enabled) {
        const nextDate = await monthlyReportScheduler.getNextScheduledDate();
        setNextScheduledDate(nextDate);
        setSnackbarMessage("Monthly reports enabled! You'll receive notifications on the selected date of each month.");
      } else {
        setNextScheduledDate(null);
        setSnackbarMessage("Monthly reports disabled.");
      }
      setSnackbarVisible(true);
    } catch (error: any) {
      console.error('Error toggling monthly reports:', error);
      setSnackbarMessage(error.message || "Failed to update monthly reports setting");
      setSnackbarVisible(true);
    }
  };


  const handlePress = useCallback(async (item: ReportOption) => {
    switch (item.id) {
      case "monthlyToggle":
        // This case is handled by the toggle in renderItem
        break;
        case "monthlyDate":
          dayPickerRef.current?.open();
          break;
      case "downloadPdf":
        showDateSelectionModal();
        break;
    }
  }, [showDateSelectionModal]);

  const renderItem = ({ item }: ListRenderItemInfo<ReportOption>) => (
    <ListItem
      bottomDivider
      containerStyle={styles.listItem}
      onPress={() => item.type !== "toggle" && handlePress(item)}
    >
      <Icon
        name={item.icon}
        type="material-community"
        size={24}
        color={COLORS.primary}
      />
      <ListItem.Content>
        <ListItem.Title style={styles.titleText}>{item.title}</ListItem.Title>
        {item.id === "monthlyToggle" && (
          <View style={styles.syncInfo}>
            <Text style={styles.syncText}>
              {monthlyReportsEnabled 
                ? nextScheduledDate 
                  ? `Next report: ${nextScheduledDate.toLocaleDateString()}`
                  : "Enabled"
                : "Disabled"
              }
            </Text>
          </View>
        )}
        {item.id === "monthlyDate" && (
          <View style={styles.syncInfo}>
            <Text style={styles.syncText}>
              Reports generated on {monthlyReportDay}{getOrdinalSuffix(monthlyReportDay)} of each month
            </Text>
          </View>
        )}
        {item.id === "downloadPdf" && generatingPdf && (
          <View style={styles.syncInfo}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={styles.syncText}>Generating PDF...</Text>
          </View>
        )}
      </ListItem.Content>
      {item.type === "toggle" ? (
        <Switch
          value={monthlyReportsEnabled}
          onValueChange={handleMonthlyReportsToggle}
          color={COLORS.primary}
        />
      ) : (
        <ListItem.Chevron />
      )}
    </ListItem>
  );

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Reports</Text>
        </View>
        <FlatList
          data={REPORT_OPTIONS}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
        >
          {snackbarMessage}
        </Snackbar>

        {/* Day Picker */}
        <DayPicker
          ref={dayPickerRef}
          onSelect={handleDaySelect}
          selectedDay={monthlyReportDay}
        />

      {/* Date Selection Modal for PDF */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeDateModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date Range</Text>
            
            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={openStartDatePicker}
              >
                <Text style={styles.dateButtonText}>
                  {pdfStartDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={openEndDatePicker}
              >
                <Text style={styles.dateButtonText}>
                  {pdfEndDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={closeDateModal}
                style={styles.modalButton}
                buttonColor={COLORS.lightGray}
                textColor={COLORS.primary}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={generatePdfReport}
                style={styles.modalButton}
                buttonColor={COLORS.primary}
                loading={generatingPdf}
                disabled={generatingPdf}
              >
                Generate PDF
              </Button>
            </View>

          </View>
        </View>
      </Modal>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showStartDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStartDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.datePickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowStartDatePicker(false)}
        >
          <TouchableOpacity 
            style={styles.datePickerModalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={styles.datePickerTitle}>Select Start Date</Text>
            <DateTimePicker
              value={pdfStartDate}
              mode="date"
              display="spinner"
              onChange={handleStartDateChange}
              maximumDate={pdfEndDate}
              accentColor={COLORS.primary}
              textColor={COLORS.primary}
              style={styles.datePicker}
            />
            <View style={styles.datePickerButtons}>
              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setShowStartDatePicker(false)}
                  style={styles.modalButton}
                  buttonColor={COLORS.lightGray}
                  textColor={COLORS.primary}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setShowStartDatePicker(false)}
                  style={styles.modalButton}
                  buttonColor={COLORS.primary}
                >
                  Done
                </Button>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal
        visible={showEndDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEndDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.datePickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowEndDatePicker(false)}
        >
          <TouchableOpacity 
            style={styles.datePickerModalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={styles.datePickerTitle}>Select End Date</Text>
            <DateTimePicker
              value={pdfEndDate}
              mode="date"
              display="spinner"
              onChange={handleEndDateChange}
              minimumDate={pdfStartDate}
              accentColor={COLORS.primary}
              textColor={COLORS.primary}
              style={styles.datePicker}
            />
            <View style={styles.datePickerButtons}>
              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setShowEndDatePicker(false)}
                  style={styles.modalButton}
                  buttonColor={COLORS.lightGray}
                  textColor={COLORS.primary}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setShowEndDatePicker(false)}
                  style={styles.modalButton}
                  buttonColor={COLORS.primary}
                >
                  Done
                </Button>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: (SIZES.padding * 5)/2,
    paddingBottom: SIZES.base,
    backgroundColor: COLORS.white,
  },
  headerText: { ...FONTS.h1, color: COLORS.primary },
  list: { paddingHorizontal: SIZES.padding, paddingBottom: SIZES.padding },
  listItem: { marginVertical: SIZES.base / 2, borderRadius: 8 },
  titleText: { ...FONTS.body3 },
  syncInfo: { marginTop: 4 },
  syncText: { ...FONTS.body4, color: COLORS.gray },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SIZES.padding * 2,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SIZES.padding,
  },
  dateSection: {
    marginBottom: SIZES.padding,
  },
  dateLabel: {
    ...FONTS.body3,
    color: COLORS.primary,
    marginBottom: SIZES.base / 2,
  },
  dateButton: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  dateButtonText: {
    ...FONTS.body3,
    color: COLORS.primary,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.padding,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: SIZES.base / 2,
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SIZES.padding * 2,
    width: '90%',
    maxWidth: 400,
  },
  datePickerTitle: {
    ...FONTS.h2,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SIZES.padding,
  },
  datePicker: {
    marginVertical: SIZES.padding,
  },
  datePickerButtons: {
    marginTop: SIZES.padding,
  },
});
