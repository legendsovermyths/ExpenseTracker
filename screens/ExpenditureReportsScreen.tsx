import React, { useCallback, useState, useEffect } from "react";
import { StyleSheet, Switch } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SPACE } from "../constants";
import { useExpensifyStore } from "../store/store";
import { PdfGenerator } from "../services/PdfGenerator";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { monthlyReportScheduler } from "../services/MonthlyReportScheduler";
import DayPicker, { DayPickerRef } from "../components/DayPicker";
import { useTheme } from "../contexts/ThemeContext";
import {
  BottomBar,
  Button,
  ListRow,
  Page,
  RowGroup,
  SectionLabel,
  Text,
  toast,
} from "../components/ui";

const ICON_INSET = SPACE.lg + 34 + SPACE.md;

const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return "th";
  const lastDigit = day % 10;
  return lastDigit === 1 ? "st" : lastDigit === 2 ? "nd" : lastDigit === 3 ? "rd" : "th";
};

export default function ExpenditureReportsScreen() {
  const { COLORS, isDark } = useTheme();

  const [monthlyReportsEnabled, setMonthlyReportsEnabled] = useState(false);
  const [nextScheduledDate, setNextScheduledDate] = useState<Date | null>(null);
  const [monthlyReportDay, setMonthlyReportDay] = useState(1);

  const [pdfStartDate, setPdfStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [pdfEndDate, setPdfEndDate] = useState(new Date());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const dayPickerRef = React.useRef<DayPickerRef>(null);

  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const monthlyBalance = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance")).value,
  );

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
    toast(`Reports scheduled for the ${day}${getOrdinalSuffix(day)}`);
  };

  const generatePdfReport = useCallback(async () => {
    setGeneratingPdf(true);
    try {
      // The picked range can reach further back than the 6-month hot window
      // — pull in older batches if needed before reading fresh from the store.
      await ensureTransactionsLoadedFrom(pdfStartDate);
      const freshTransactions = Object.values(useExpensifyStore.getState().transactions);
      const pdfGenerator = new PdfGenerator(
        freshTransactions,
        accountsById,
        categoriesById,
        monthlyBalance
      );
      await pdfGenerator.generateAndSharePdf(pdfStartDate, pdfEndDate);
      toast("PDF report ready");
    } catch (error: any) {
      toast(error.message || "Couldn't generate the PDF", "error");
    } finally {
      setGeneratingPdf(false);
    }
  }, [accountsById, categoriesById, monthlyBalance, pdfStartDate, pdfEndDate]);

  const handleMonthlyReportsToggle = async (enabled: boolean) => {
    try {
      await monthlyReportScheduler.setMonthlyReportEnabled(enabled);
      setMonthlyReportsEnabled(enabled);
      if (enabled) {
        const nextDate = await monthlyReportScheduler.getNextScheduledDate();
        setNextScheduledDate(nextDate);
        toast("Monthly reports on");
      } else {
        setNextScheduledDate(null);
        toast("Monthly reports off", "info");
      }
    } catch (error: any) {
      toast(error.message || "Couldn't update reports", "error");
    }
  };

  const status = monthlyReportsEnabled
    ? nextScheduledDate
      ? `Next on ${nextScheduledDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
      : "On"
    : "Off";

  return (
    <>
      <Page
        title="Reports"
        footer={
          <BottomBar>
            <Button
              title="Generate PDF report"
              icon="file-pdf-box"
              onPress={generatePdfReport}
              loading={generatingPdf}
              disabled={generatingPdf}
            />
          </BottomBar>
        }
      >
        <SectionLabel title="Scheduled" />
        <RowGroup inset={ICON_INSET}>
          <ListRow
            icon="email-outline"
            title="Monthly email report"
            subtitle={status}
            trailing={
              <Switch
                value={monthlyReportsEnabled}
                onValueChange={handleMonthlyReportsToggle}
                trackColor={{ true: COLORS.accent }}
              />
            }
          />
          <ListRow
            icon="calendar-outline"
            title="Report day"
            value={`${monthlyReportDay}${getOrdinalSuffix(monthlyReportDay)} of the month`}
            chevron
            onPress={() => dayPickerRef.current?.open()}
          />
        </RowGroup>

        <SectionLabel title="Export PDF" />
        <RowGroup inset={ICON_INSET}>
          <ListRow
            icon="calendar-start"
            title="From"
            trailing={
              <DateTimePicker
                value={pdfStartDate}
                mode="date"
                display="default"
                onChange={(e, d) => d && setPdfStartDate(d)}
                maximumDate={pdfEndDate}
                themeVariant={isDark ? "dark" : "light"}
                accentColor={COLORS.accent}
              />
            }
          />
          <ListRow
            icon="calendar-end"
            title="To"
            trailing={
              <DateTimePicker
                value={pdfEndDate}
                mode="date"
                display="default"
                onChange={(e, d) => d && setPdfEndDate(d)}
                minimumDate={pdfStartDate}
                themeVariant={isDark ? "dark" : "light"}
                accentColor={COLORS.accent}
              />
            }
          />
        </RowGroup>
        <Text variant="callout" tone="muted" style={styles.note}>
          Builds a PDF of your transactions in this range and opens the share sheet.
        </Text>
      </Page>

      <DayPicker ref={dayPickerRef} onSelect={handleDaySelect} selectedDay={monthlyReportDay} />
    </>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: SPACE.sm, paddingHorizontal: SPACE.lg },
});
