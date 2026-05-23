import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '../types/entity/Transaction';
import { Category } from '../types/entity/Category';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const MONTHLY_REPORT_KEY = 'monthly_report_enabled';
const LAST_SCHEDULED_KEY = 'last_scheduled_monthly_report';
const MONTHLY_REPORT_DAY_KEY = 'monthly_report_day';

export class MonthlyReportScheduler {
  private static instance: MonthlyReportScheduler;
  
  private constructor() {}
  
  public static getInstance(): MonthlyReportScheduler {
    if (!MonthlyReportScheduler.instance) {
      MonthlyReportScheduler.instance = new MonthlyReportScheduler();
    }
    return MonthlyReportScheduler.instance;
  }

  /**
   * Request notification permissions
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }
      
      // For Android, we need to set the notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('monthly-reports', {
          name: 'Monthly Reports',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Check if monthly reports are enabled
   */
  public async isMonthlyReportEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(MONTHLY_REPORT_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking monthly report status:', error);
      return false;
    }
  }

  /**
   * Get the monthly report day (1-31)
   */
  public async getMonthlyReportDay(): Promise<number> {
    try {
      const day = await AsyncStorage.getItem(MONTHLY_REPORT_DAY_KEY);
      return day ? parseInt(day) : 1; // Default to 1st of month
    } catch (error) {
      console.error('Error getting monthly report day:', error);
      return 1;
    }
  }

  /**
   * Set the monthly report day (1-31)
   */
  public async setMonthlyReportDay(day: number): Promise<void> {
    try {
      if (day < 1 || day > 31) {
        throw new Error('Monthly report day must be between 1 and 31');
      }
      await AsyncStorage.setItem(MONTHLY_REPORT_DAY_KEY, day.toString());
    } catch (error) {
      console.error('Error setting monthly report day:', error);
      throw error;
    }
  }

  /**
   * Enable or disable monthly reports
   */
  public async setMonthlyReportEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(MONTHLY_REPORT_KEY, enabled.toString());
      
      if (enabled) {
        await this.scheduleNextMonthlyReport();
      } else {
        await this.cancelScheduledReports();
      }
    } catch (error) {
      console.error('Error setting monthly report status:', error);
      throw error;
    }
  }

  /**
   * Build a summary string from last month's transactions
   */
  public static buildMonthlySummary(
    transactions: Transaction[],
    categoriesById: Record<number, Category>,
  ): string {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const lastMonthTxns = transactions.filter((t) => {
      const d = new Date(t.date_time);
      return d.getMonth() === lastMonth && d.getFullYear() === lastYear;
    });

    const debits = lastMonthTxns.filter((t) => !t.is_credit);
    const totalSpent = debits.reduce((a, t) => a + t.amount, 0);
    const txnCount = debits.length;

    if (txnCount === 0) {
      return "Tap to view your monthly report.";
    }

    // Find top category
    const catSpend: Record<number, number> = {};
    debits.forEach((t) => {
      catSpend[t.category_id] = (catSpend[t.category_id] || 0) + t.amount;
    });
    const topCatId = Object.entries(catSpend).sort(([, a], [, b]) => b - a)[0]?.[0];
    const topCatName = topCatId ? categoriesById[Number(topCatId)]?.name : null;

    const months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const monthName = months[lastMonth];

    const spentStr = `₹${Math.round(totalSpent).toLocaleString("en-IN")}`;
    let summary = `In ${monthName} you spent ${spentStr} across ${txnCount} transaction${txnCount !== 1 ? "s" : ""}.`;
    if (topCatName) {
      summary += ` ${topCatName} was your top category.`;
    }
    return summary;
  }

  /**
   * Schedule the next monthly report notification
   */
  public async scheduleNextMonthlyReport(summaryText?: string): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Notification permissions not granted');
      }

      // Cancel any existing scheduled reports
      await this.cancelScheduledReports();

      // Calculate next month's report day
      const now = new Date();
      const reportDay = await this.getMonthlyReportDay();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, reportDay);

      // Set time to 9:00 AM
      nextMonth.setHours(9, 0, 0, 0);

      const body = summaryText || 'Your monthly expense report is ready! Tap to send it to your email.';

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Monthly Expense Report',
          body,
          data: {
            type: 'monthly_report',
            action: 'send_report'
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextMonth,
        },
      });

      // Store the notification ID and scheduled date
      await AsyncStorage.setItem(LAST_SCHEDULED_KEY, JSON.stringify({
        notificationId,
        scheduledDate: nextMonth.toISOString(),
      }));

      console.log(`Monthly report scheduled for ${nextMonth.toLocaleDateString()}`);
    } catch (error) {
      console.error('Error scheduling monthly report:', error);
      throw error;
    }
  }

  /**
   * Cancel all scheduled monthly report notifications
   */
  public async cancelScheduledReports(): Promise<void> {
    try {
      const scheduledData = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
      if (scheduledData) {
        const { notificationId } = JSON.parse(scheduledData);
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        await AsyncStorage.removeItem(LAST_SCHEDULED_KEY);
        console.log('Cancelled scheduled monthly report');
      }
    } catch (error) {
      console.error('Error cancelling scheduled reports:', error);
    }
  }

  /**
   * Get the next scheduled date for monthly report
   */
  public async getNextScheduledDate(): Promise<Date | null> {
    try {
      const scheduledData = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
      if (scheduledData) {
        const { scheduledDate } = JSON.parse(scheduledData);
        return new Date(scheduledDate);
      }
      return null;
    } catch (error) {
      console.error('Error getting next scheduled date:', error);
      return null;
    }
  }

  /**
   * Handle notification response (when user taps the notification)
   * This method should be called from the app with the current data
   */
  public async handleNotificationResponse(
    response: Notifications.NotificationResponse,
    sendEmailCallback: () => Promise<void>,
    summaryText?: string,
  ): Promise<void> {
    try {
      const { data } = response.notification.request.content;

      if (data?.type === 'monthly_report' && data?.action === 'send_report') {
        // Call the email sending function provided by the app
        await sendEmailCallback();

        // Schedule the next month's report with fresh summary
        await this.scheduleNextMonthlyReport(summaryText);
      }
    } catch (error) {
      console.error('Error handling notification response:', error);
    }
  }

  /**
   * Initialize the scheduler (call this when app starts)
   */
  public async initialize(summaryText?: string): Promise<void> {
    try {
      const isEnabled = await this.isMonthlyReportEnabled();

      if (isEnabled) {
        // Check if we need to reschedule (in case the app was closed and reopened)
        const nextScheduled = await this.getNextScheduledDate();
        const now = new Date();

        if (!nextScheduled || nextScheduled <= now) {
          // Reschedule if no date is set or if the scheduled date has passed
          await this.scheduleNextMonthlyReport(summaryText);
        }
      }
    } catch (error) {
      console.error('Error initializing monthly report scheduler:', error);
    }
  }
}

// Export singleton instance
export const monthlyReportScheduler = MonthlyReportScheduler.getInstance();
